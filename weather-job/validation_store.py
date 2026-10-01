from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Iterable


FORECAST_INTERVAL_SECONDS = 3 * 60 * 60
SECONDS_PER_HOUR = 60 * 60
ACTUAL_MATCH_TOLERANCE_SECONDS = 90 * 60
FORECAST_HORIZON_TOLERANCE_HOURS = 2.0
PRECIP_SLOT_TOLERANCE_SECONDS = 55 * 60
OBSERVATION_BUFFER_HOURS = 8
HORIZONS = (1, 2, 3, 4, 5)

SCHEMA_VERSION = 1

UNITS = {
    "temperature": "C",
    "humidity": "%",
    "wind_speed": "m/s",
    "cloud_cover": "%",
    "probability_of_precipitation": "0-1",
    "precipitation": "mm",
}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def datetime_to_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def iso_to_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def empty_document(
    city_slug: str,
    city_name: str | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "city_slug": city_slug,
        "city": city_name or city_slug,
        "country": None,
        "timezone_offset": None,
        "updated_at": None,
        "units": deepcopy(UNITS),
        "points": [],
        # Internal rolling helper state. This is intentionally short-lived;
        # completed validation points in "points" are retained indefinitely.
        "_observations": [],
    }


def load_document_from_blob(
    bucket,
    city_slug: str,
    city_name: str | None = None,
    prefix: str = "processed",
) -> dict[str, Any]:
    blob = bucket.blob(f"{prefix}/{city_slug}.json")

    if not blob.exists():
        return empty_document(city_slug, city_name)

    data = json.loads(blob.download_as_text(encoding="utf-8"))
    data.setdefault("schema_version", SCHEMA_VERSION)
    data.setdefault("city_slug", city_slug)
    data.setdefault("city", city_name or city_slug)
    data.setdefault("country", None)
    data.setdefault("timezone_offset", None)
    data.setdefault("updated_at", None)
    data.setdefault("units", deepcopy(UNITS))
    data.setdefault("points", [])
    data.setdefault("_observations", [])
    return data


def save_document_to_blob(
    bucket,
    document: dict[str, Any],
    prefix: str = "processed",
) -> str:
    city_slug = document["city_slug"]
    object_name = f"{prefix}/{city_slug}.json"
    blob = bucket.blob(object_name)
    blob.upload_from_string(
        json.dumps(
            document,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        content_type="application/json",
    )
    return object_name


def _first_weather(data: dict[str, Any]) -> dict[str, Any]:
    items = data.get("weather") or []
    if not items:
        return {}
    return items[0] or {}


def normalize_forecast(item: dict[str, Any]) -> dict[str, Any]:
    main = item.get("main") or {}
    weather = _first_weather(item)
    wind = item.get("wind") or {}
    clouds = item.get("clouds") or {}

    rain_3h = float((item.get("rain") or {}).get("3h", 0) or 0)
    snow_3h = float((item.get("snow") or {}).get("3h", 0) or 0)

    return {
        "temperature": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "humidity": main.get("humidity"),
        "wind_speed": wind.get("speed"),
        "cloud_cover": clouds.get("all"),
        "weather_main": weather.get("main"),
        "weather_description": weather.get("description"),
        "probability_of_precipitation": item.get("pop", 0) or 0,
        "rain_3h": rain_3h,
        "snow_3h": snow_3h,
        "precipitation_3h": rain_3h + snow_3h,
    }


def normalize_current_observation(
    data: dict[str, Any],
    collected_at: datetime,
) -> dict[str, Any] | None:
    observed_at = data.get("dt")
    if observed_at is None:
        return None

    main = data.get("main") or {}
    weather = _first_weather(data)
    wind = data.get("wind") or {}
    clouds = data.get("clouds") or {}

    # OpenWeather omits rain/snow objects when the amount is zero.
    # Missing fields in an otherwise valid observation therefore mean 0.
    rain_1h = float((data.get("rain") or {}).get("1h", 0) or 0)
    snow_1h = float((data.get("snow") or {}).get("1h", 0) or 0)

    return {
        "observed_at": int(observed_at),
        "collected_at": datetime_to_iso(collected_at),
        "temperature": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "humidity": main.get("humidity"),
        "wind_speed": wind.get("speed"),
        "cloud_cover": clouds.get("all"),
        "weather_main": weather.get("main"),
        "weather_description": weather.get("description"),
        "rain_1h": rain_1h,
        "snow_1h": snow_1h,
    }


def _point_map(document: dict[str, Any]) -> dict[int, dict[str, Any]]:
    result: dict[int, dict[str, Any]] = {}
    for point in document.get("points", []):
        timestamp = point.get("timestamp")
        if timestamp is None:
            continue
        result[int(timestamp)] = point
    return result


def _new_point(timestamp: int) -> dict[str, Any]:
    return {
        "timestamp": int(timestamp),
        "actual": None,
        "forecasts": {
            "1d": None,
            "2d": None,
            "3d": None,
            "4d": None,
            "5d": None,
        },
    }


def _ensure_point(
    points_by_timestamp: dict[int, dict[str, Any]],
    timestamp: int,
) -> dict[str, Any]:
    point = points_by_timestamp.get(timestamp)
    if point is None:
        point = _new_point(timestamp)
        points_by_timestamp[timestamp] = point
    else:
        forecasts = point.setdefault("forecasts", {})
        for horizon in HORIZONS:
            forecasts.setdefault(f"{horizon}d", None)
        point.setdefault("actual", None)
    return point


def _candidate_is_better(
    existing: dict[str, Any] | None,
    lead_hours: float,
    horizon: int,
) -> bool:
    if existing is None:
        return True

    existing_lead = existing.get("lead_hours")
    if existing_lead is None:
        return True

    target_lead = horizon * 24
    return abs(lead_hours - target_lead) < abs(float(existing_lead) - target_lead)


def apply_forecast_collection(
    document: dict[str, Any],
    forecast_data: dict[str, Any],
    collected_at: datetime,
) -> None:
    city_data = forecast_data.get("city") or {}
    if not document.get("city"):
        document["city"] = city_data.get("name")
    document["country"] = city_data.get("country") or document.get("country")
    document["timezone_offset"] = city_data.get("timezone")

    collected_epoch = collected_at.timestamp()
    collected_iso = datetime_to_iso(collected_at)
    points_by_timestamp = _point_map(document)

    for item in forecast_data.get("list") or []:
        target_timestamp = item.get("dt")
        if target_timestamp is None:
            continue

        target_timestamp = int(target_timestamp)
        lead_hours = (target_timestamp - collected_epoch) / SECONDS_PER_HOUR

        selected_horizon: int | None = None
        selected_distance: float | None = None

        for horizon in HORIZONS:
            distance = abs(lead_hours - horizon * 24)
            if distance > FORECAST_HORIZON_TOLERANCE_HOURS:
                continue
            if selected_distance is None or distance < selected_distance:
                selected_horizon = horizon
                selected_distance = distance

        if selected_horizon is None:
            continue

        point = _ensure_point(points_by_timestamp, target_timestamp)
        key = f"{selected_horizon}d"
        existing = point["forecasts"].get(key)

        if not _candidate_is_better(existing, lead_hours, selected_horizon):
            continue

        candidate = normalize_forecast(item)
        candidate["collected_at"] = collected_iso
        candidate["lead_hours"] = round(lead_hours, 2)
        point["forecasts"][key] = candidate

    document["points"] = sorted(
        points_by_timestamp.values(),
        key=lambda point: point["timestamp"],
    )


def _actual_distance(point: dict[str, Any], observed_at: int) -> int | None:
    actual = point.get("actual")
    if not actual:
        return None
    existing_observed_at = actual.get("observed_at")
    if existing_observed_at is None:
        return None
    return abs(int(existing_observed_at) - int(point["timestamp"]))


def _actual_from_observation(
    observation: dict[str, Any],
    existing_actual: dict[str, Any] | None = None,
) -> dict[str, Any]:
    existing_actual = existing_actual or {}
    return {
        "observed_at": observation["observed_at"],
        "temperature": observation.get("temperature"),
        "feels_like": observation.get("feels_like"),
        "humidity": observation.get("humidity"),
        "wind_speed": observation.get("wind_speed"),
        "cloud_cover": observation.get("cloud_cover"),
        "weather_main": observation.get("weather_main"),
        "weather_description": observation.get("weather_description"),
        # Preserve any already-computed 3-hour precipitation while replacing
        # the instantaneous values with a closer observation.
        "rain_3h": existing_actual.get("rain_3h"),
        "snow_3h": existing_actual.get("snow_3h"),
        "precipitation_3h": existing_actual.get("precipitation_3h"),
    }


def _add_observation_to_buffer(
    document: dict[str, Any],
    observation: dict[str, Any],
) -> None:
    observations = document.setdefault("_observations", [])

    # Deduplicate by the provider observation timestamp. If OpenWeather returns
    # the same station observation on consecutive collections, keep the latest
    # collected copy but do not count it twice for precipitation.
    by_timestamp = {
        int(item["observed_at"]): item
        for item in observations
        if item.get("observed_at") is not None
    }
    by_timestamp[int(observation["observed_at"])] = observation

    latest_timestamp = max(by_timestamp)
    minimum_timestamp = latest_timestamp - OBSERVATION_BUFFER_HOURS * SECONDS_PER_HOUR

    document["_observations"] = [
        by_timestamp[timestamp]
        for timestamp in sorted(by_timestamp)
        if timestamp >= minimum_timestamp
    ]


def _nearest_unique_observations(
    observations: Iterable[dict[str, Any]],
    expected_timestamps: list[int],
) -> list[dict[str, Any]] | None:
    pool = list(observations)
    chosen: list[dict[str, Any]] = []
    used_indices: set[int] = set()

    for expected in expected_timestamps:
        best_index: int | None = None
        best_distance: int | None = None

        for index, observation in enumerate(pool):
            if index in used_indices:
                continue
            observed_at = observation.get("observed_at")
            if observed_at is None:
                continue
            distance = abs(int(observed_at) - expected)
            if distance > PRECIP_SLOT_TOLERANCE_SECONDS:
                continue
            if best_distance is None or distance < best_distance:
                best_index = index
                best_distance = distance

        if best_index is None:
            return None

        used_indices.add(best_index)
        chosen.append(pool[best_index])

    return chosen


def _update_actual_precipitation(
    document: dict[str, Any],
) -> None:
    observations = document.get("_observations", [])
    if len(observations) < 3:
        return

    oldest = min(int(item["observed_at"]) for item in observations)
    newest = max(int(item["observed_at"]) for item in observations)

    for point in document.get("points", []):
        target = int(point["timestamp"])
        if target < oldest + 2 * SECONDS_PER_HOUR:
            continue
        if target > newest + PRECIP_SLOT_TOLERANCE_SECONDS:
            continue

        actual = point.get("actual")
        if not actual:
            continue

        expected = [
            target - 2 * SECONDS_PER_HOUR,
            target - 1 * SECONDS_PER_HOUR,
            target,
        ]
        selected = _nearest_unique_observations(observations, expected)
        if selected is None:
            continue

        rain_3h = round(sum(float(item.get("rain_1h", 0) or 0) for item in selected), 4)
        snow_3h = round(sum(float(item.get("snow_1h", 0) or 0) for item in selected), 4)

        actual["rain_3h"] = rain_3h
        actual["snow_3h"] = snow_3h
        actual["precipitation_3h"] = round(rain_3h + snow_3h, 4)


def apply_current_observation(
    document: dict[str, Any],
    current_data: dict[str, Any],
    collected_at: datetime,
) -> None:
    observation = normalize_current_observation(current_data, collected_at)
    if observation is None:
        return

    _add_observation_to_buffer(document, observation)

    observed_at = int(observation["observed_at"])
    best_point: dict[str, Any] | None = None
    best_distance: int | None = None

    for point in document.get("points", []):
        distance = abs(int(point["timestamp"]) - observed_at)
        if distance > ACTUAL_MATCH_TOLERANCE_SECONDS:
            continue
        if best_distance is None or distance < best_distance:
            best_point = point
            best_distance = distance

    if best_point is not None and best_distance is not None:
        existing_distance = _actual_distance(best_point, observed_at)
        if existing_distance is None or best_distance < existing_distance:
            best_point["actual"] = _actual_from_observation(
                observation,
                best_point.get("actual"),
            )

    _update_actual_precipitation(document)


def update_document(
    document: dict[str, Any],
    current_data: dict[str, Any],
    forecast_data: dict[str, Any],
    collected_at: datetime,
) -> dict[str, Any]:
    apply_forecast_collection(document, forecast_data, collected_at)
    apply_current_observation(document, current_data, collected_at)
    document["updated_at"] = datetime_to_iso(collected_at)
    return document


def update_city_file(
    bucket,
    city_slug: str,
    city_name: str,
    current_data: dict[str, Any],
    forecast_data: dict[str, Any],
    collected_at: datetime,
    prefix: str = "processed",
) -> dict[str, Any]:
    document = load_document_from_blob(
        bucket,
        city_slug=city_slug,
        city_name=city_name,
        prefix=prefix,
    )
    update_document(
        document,
        current_data=current_data,
        forecast_data=forecast_data,
        collected_at=collected_at,
    )
    save_document_to_blob(bucket, document, prefix=prefix)
    return document
