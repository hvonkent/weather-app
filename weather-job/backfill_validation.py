from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from typing import Any

from google.cloud import storage

from validation_store import (
    apply_current_observation,
    apply_forecast_collection,
    datetime_to_iso,
    empty_document,
    save_document_to_blob,
)


BUCKET_NAME = os.environ.get("WEATHER_BUCKET")
if not BUCKET_NAME:
    raise RuntimeError("WEATHER_BUCKET environment variable is not set.")


CITIES = {
    "amsterdam": "Amsterdam",
    "bremen": "Bremen",
    "munich": "Munich",
    "rochester_mn": "Rochester",
    "boston_ma": "Boston",
}


TIMESTAMP_PATTERN = re.compile(r"_(\d{8}T\d{6}Z)\.json$")


def collection_datetime(object_name: str) -> datetime | None:
    match = TIMESTAMP_PATTERN.search(object_name)
    if not match:
        return None
    return datetime.strptime(
        match.group(1),
        "%Y%m%dT%H%M%SZ",
    ).replace(tzinfo=timezone.utc)


def list_records(bucket, prefix: str) -> list[dict[str, Any]]:
    records = []
    for blob in bucket.list_blobs(prefix=prefix):
        if not blob.name.endswith(".json"):
            continue
        collected_at = collection_datetime(blob.name)
        if collected_at is None:
            continue
        records.append({"blob": blob, "collected_at": collected_at})

    records.sort(key=lambda record: record["collected_at"])
    return records


def read_json(blob) -> dict[str, Any]:
    return json.loads(blob.download_as_text(encoding="utf-8"))


def backfill_city(bucket, city_slug: str, output_prefix: str) -> dict[str, Any]:
    city_name = CITIES[city_slug]
    document = empty_document(city_slug, city_name)

    forecast_records = list_records(
        bucket,
        f"forecast/{city_slug}_forecast_",
    )
    current_records = list_records(
        bucket,
        f"current_weather/{city_slug}_current_weather_",
    )

    if not forecast_records:
        raise RuntimeError(f"No forecast files found for {city_slug}.")
    if not current_records:
        raise RuntimeError(f"No current-weather files found for {city_slug}.")

    print(
        f"{city_slug}: {len(forecast_records)} forecast files, "
        f"{len(current_records)} current files"
    )

    # Forecasts create the complete 3-hour target grid and select the snapshot
    # closest to each nominal 1d/2d/3d/4d/5d lead time.
    for index, record in enumerate(forecast_records, start=1):
        apply_forecast_collection(
            document,
            read_json(record["blob"]),
            record["collected_at"],
        )
        if index % 250 == 0:
            print(f"  forecasts: {index}/{len(forecast_records)}")

    # Current observations are then matched to those target timestamps. The
    # rolling hourly buffer is sufficient to build actual 3-hour rain+snow.
    for index, record in enumerate(current_records, start=1):
        apply_current_observation(
            document,
            read_json(record["blob"]),
            record["collected_at"],
        )
        if index % 500 == 0:
            print(f"  current:   {index}/{len(current_records)}")

    latest_collection = max(
        forecast_records[-1]["collected_at"],
        current_records[-1]["collected_at"],
    )
    document["updated_at"] = datetime_to_iso(latest_collection)

    object_name = save_document_to_blob(
        bucket,
        document,
        prefix=output_prefix,
    )

    completed = sum(1 for point in document["points"] if point.get("actual"))
    print(
        f"  wrote gs://{BUCKET_NAME}/{object_name}: "
        f"{len(document['points'])} points, {completed} with actual observations"
    )
    return document


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build compact per-city validation JSON files from the existing "
            "raw OpenWeather history. Raw source files are not deleted."
        )
    )
    parser.add_argument(
        "--city",
        choices=[*CITIES.keys(), "all"],
        default="all",
    )
    parser.add_argument(
        "--output-prefix",
        default="processed",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)

    city_slugs = CITIES.keys() if args.city == "all" else [args.city]

    for city_slug in city_slugs:
        backfill_city(bucket, city_slug, args.output_prefix)

    print("Backfill complete. Existing raw files were left untouched.")


if __name__ == "__main__":
    main()
