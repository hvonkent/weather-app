"""
Minimal integration example for weather-job/main.py.

After the collector has fetched BOTH OpenWeather responses for a city, call
update_city_file(). During the migration you can keep the existing raw uploads;
after the processed files are verified, those raw uploads can be removed.
"""

from datetime import datetime, timezone

from google.cloud import storage

from validation_store import update_city_file


storage_client = storage.Client()


def process_city_collection(
    bucket_name: str,
    city_slug: str,
    city_name: str,
    current_data: dict,
    forecast_data: dict,
    collected_at: datetime | None = None,
):
    if collected_at is None:
        collected_at = datetime.now(timezone.utc)

    bucket = storage_client.bucket(bucket_name)

    return update_city_file(
        bucket=bucket,
        city_slug=city_slug,
        city_name=city_name,
        current_data=current_data,
        forecast_data=forecast_data,
        collected_at=collected_at,
    )
