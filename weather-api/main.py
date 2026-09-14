import json
import os
import re

from datetime import datetime, timezone

from flask import Flask, jsonify, request
from google.cloud import storage


app = Flask(__name__)


BUCKET_NAME = os.environ.get("WEATHER_BUCKET")

if not BUCKET_NAME:
    raise RuntimeError(
        "WEATHER_BUCKET environment variable is not set."
    )


CITIES = {
    "amsterdam": "Amsterdam",
    "bremen": "Bremen",
    "munich": "Munich",
    "rochester_mn": "Rochester",
    "boston_ma": "Boston",
}


storage_client = storage.Client()


COLLECTION_TIMESTAMP_PATTERN = re.compile(
    r"_(\d{8}T\d{6}Z)\.json$"
)

FORECAST_INTERVAL_SECONDS = 3 * 60 * 60
SECONDS_PER_DAY = 24 * 60 * 60
ACTUAL_MATCH_TOLERANCE_SECONDS = 90 * 60
FORECAST_COLLECTION_TOLERANCE_SECONDS = 2 * 60 * 60

# Cache validation payloads for the lifetime of a Cloud Run instance.
# The key includes the newest source object names, so a new hourly
# collection automatically invalidates the previous cached result.
_validation_cache = {}


def get_collection_datetime(
    object_name: str,
):
    match = COLLECTION_TIMESTAMP_PATTERN.search(
        object_name
    )

    if not match:
        return None

    return datetime.strptime(
        match.group(1),
        "%Y%m%dT%H%M%SZ",
    ).replace(
        tzinfo=timezone.utc
    )


def datetime_to_iso(
    value: datetime,
):
    return (
        value
        .isoformat()
        .replace("+00:00", "Z")
    )


def get_collection_timestamp(
    object_name: str,
):
    """
    Convert a filename timestamp like:

    20260825T180230Z

    into:

    2026-08-25T18:02:30Z
    """

    timestamp = get_collection_datetime(
        object_name
    )

    if timestamp is None:
        return None

    return datetime_to_iso(
        timestamp
    )


def get_latest_blob(
    prefix: str,
):
    """
    Find the newest JSON object whose
    name starts with the supplied prefix.

    Because our filenames end in sortable
    UTC timestamps, lexicographically largest
    filename = newest collection.
    """

    blobs = storage_client.list_blobs(
        BUCKET_NAME,
        prefix=prefix,
    )

    json_blobs = (
        blob
        for blob in blobs
        if blob.name.endswith(".json")
    )

    latest_blob = max(
        json_blobs,
        key=lambda blob: blob.name,
        default=None,
    )

    if latest_blob is None:
        raise FileNotFoundError(
            f"No JSON files found for prefix: {prefix}"
        )

    return latest_blob


def list_timestamped_blobs(
    prefix: str,
):
    records = []

    for blob in storage_client.list_blobs(
        BUCKET_NAME,
        prefix=prefix,
    ):
        if not blob.name.endswith(".json"):
            continue

        collected_at = get_collection_datetime(
            blob.name
        )

        if collected_at is None:
            continue

        records.append(
            {
                "blob": blob,
                "collected_at": collected_at,
            }
        )

    records.sort(
        key=lambda record: record["collected_at"]
    )

    return records


def load_json(
    blob,
):
    text = blob.download_as_text(
        encoding="utf-8"
    )

    return json.loads(text)


def normalize_current(
    data: dict,
):
    main = data.get(
        "main",
        {},
    )

    weather_items = (
        data.get("weather")
        or [{}]
    )

    weather = weather_items[0]

    wind = data.get(
        "wind",
        {},
    )

    clouds = data.get(
        "clouds",
        {},
    )

    rain = data.get(
        "rain",
        {},
    )

    return {
        "timestamp": data.get(
            "dt"
        ),

        "temperature": main.get(
            "temp"
        ),

        "feels_like": main.get(
            "feels_like"
        ),

        "humidity": main.get(
            "humidity"
        ),

        "pressure": main.get(
            "pressure"
        ),

        "description": weather.get(
            "description"
        ),

        "weather": weather.get(
            "main"
        ),

        "icon": weather.get(
            "icon"
        ),

        "wind_speed": wind.get(
            "speed"
        ),

        "wind_direction": wind.get(
            "deg"
        ),

        "wind_gust": wind.get(
            "gust"
        ),

        "cloud_cover": clouds.get(
            "all"
        ),

        "visibility": data.get(
            "visibility"
        ),

        "rain_1h": rain.get(
            "1h",
            0,
        ),
    }


def normalize_forecast_point(
    item: dict,
):
    main = item.get(
        "main",
        {},
    )

    wind = item.get(
        "wind",
        {},
    )

    rain = item.get(
        "rain",
        {},
    )

    return {
        "timestamp": item.get(
            "dt"
        ),

        "temperature": main.get(
            "temp"
        ),

        "wind_speed": wind.get(
            "speed"
        ),

        "pop": item.get(
            "pop",
            0,
        ),

        "rain_3h": rain.get(
            "3h",
            0,
        ),
    }


def nearest_records(
    records,
    target_datetime: datetime,
    limit: int,
):
    return sorted(
        records,
        key=lambda record: abs(
            (
                record["collected_at"]
                - target_datetime
            ).total_seconds()
        ),
    )[:limit]


def get_cached_json(
    record,
    json_cache: dict,
):
    object_name = record["blob"].name

    if object_name not in json_cache:
        json_cache[object_name] = load_json(
            record["blob"]
        )

    return json_cache[object_name]


def find_actual_for_target(
    current_records,
    target_timestamp: int,
    json_cache: dict,
):
    target_datetime = datetime.fromtimestamp(
        target_timestamp,
        tz=timezone.utc,
    )

    candidates = nearest_records(
        current_records,
        target_datetime,
        limit=4,
    )

    best = None

    for record in candidates:
        data = get_cached_json(
            record,
            json_cache,
        )

        observed_at = data.get("dt")
        temperature = (
            data.get("main", {})
            .get("temp")
        )

        if (
            observed_at is None
            or temperature is None
        ):
            continue

        distance = abs(
            observed_at
            - target_timestamp
        )

        if (
            best is None
            or distance < best["distance"]
        ):
            best = {
                "distance": distance,
                "timestamp": observed_at,
                "temperature": temperature,
                "collected_at": datetime_to_iso(
                    record["collected_at"]
                ),
            }

    if (
        best is None
        or best["distance"]
        > ACTUAL_MATCH_TOLERANCE_SECONDS
    ):
        return None

    return best


def find_forecast_for_target(
    forecast_records,
    target_timestamp: int,
    days_ahead: int,
    json_cache: dict,
):
    desired_collection_timestamp = (
        target_timestamp
        - days_ahead * SECONDS_PER_DAY
    )

    desired_collection_datetime = (
        datetime.fromtimestamp(
            desired_collection_timestamp,
            tz=timezone.utc,
        )
    )

    # The 5-day/3-hour product can require a snapshot slightly
    # after the exact 120-hour mark for the final target point to
    # be present. Inspect several nearby hourly collections and
    # choose the closest one that actually contains this target.
    candidates = nearest_records(
        forecast_records,
        desired_collection_datetime,
        limit=5,
    )

    for record in candidates:
        collection_distance = abs(
            (
                record["collected_at"]
                - desired_collection_datetime
            ).total_seconds()
        )

        if (
            collection_distance
            > FORECAST_COLLECTION_TOLERANCE_SECONDS
        ):
            continue

        data = get_cached_json(
            record,
            json_cache,
        )

        matching_item = next(
            (
                item
                for item in data.get("list", [])
                if item.get("dt")
                == target_timestamp
            ),
            None,
        )

        if matching_item is None:
            continue

        temperature = (
            matching_item
            .get("main", {})
            .get("temp")
        )

        if temperature is None:
            continue

        lead_hours = (
            target_timestamp
            - record["collected_at"].timestamp()
        ) / 3600

        return {
            "days_ahead": days_ahead,
            "temperature": temperature,
            "collected_at": datetime_to_iso(
                record["collected_at"]
            ),
            "lead_hours": round(
                lead_hours,
                2,
            ),
        }

    return {
        "days_ahead": days_ahead,
        "temperature": None,
        "collected_at": None,
        "lead_hours": None,
    }


def build_temperature_validation(
    city_slug: str,
    days: int,
):
    current_prefix = (
        "current_weather/"
        f"{city_slug}_current_weather_"
    )

    forecast_prefix = (
        "forecast/"
        f"{city_slug}_forecast_"
    )

    current_records = list_timestamped_blobs(
        current_prefix
    )

    forecast_records = list_timestamped_blobs(
        forecast_prefix
    )

    if not current_records:
        raise FileNotFoundError(
            f"No current-weather files found for {city_slug}."
        )

    if not forecast_records:
        raise FileNotFoundError(
            f"No forecast files found for {city_slug}."
        )

    latest_current_record = current_records[-1]
    latest_forecast_record = forecast_records[-1]

    cache_key = (
        city_slug,
        days,
        latest_current_record["blob"].name,
        latest_forecast_record["blob"].name,
    )

    cached = _validation_cache.get(
        cache_key
    )

    if cached is not None:
        return cached

    json_cache = {}

    latest_current_data = get_cached_json(
        latest_current_record,
        json_cache,
    )

    latest_observed_timestamp = (
        latest_current_data.get("dt")
        or int(
            latest_current_record[
                "collected_at"
            ].timestamp()
        )
    )

    # Anchor the x-axis to OpenWeather's 3-hour forecast grid.
    target_end = (
        latest_observed_timestamp
        // FORECAST_INTERVAL_SECONDS
        * FORECAST_INTERVAL_SECONDS
    )

    point_count = days * 8
    target_start = (
        target_end
        - (point_count - 1)
        * FORECAST_INTERVAL_SECONDS
    )

    latest_forecast_data = get_cached_json(
        latest_forecast_record,
        json_cache,
    )

    forecast_city = latest_forecast_data.get(
        "city",
        {},
    )

    points = []

    for index in range(point_count):
        target_timestamp = (
            target_start
            + index
            * FORECAST_INTERVAL_SECONDS
        )

        actual = find_actual_for_target(
            current_records,
            target_timestamp,
            json_cache,
        )

        forecasts = [
            find_forecast_for_target(
                forecast_records,
                target_timestamp,
                days_ahead,
                json_cache,
            )
            for days_ahead in range(1, 6)
        ]

        points.append(
            {
                "timestamp": target_timestamp,
                "actual_temperature": (
                    actual["temperature"]
                    if actual
                    else None
                ),
                "actual_observed_at": (
                    actual["timestamp"]
                    if actual
                    else None
                ),
                "actual_collected_at": (
                    actual["collected_at"]
                    if actual
                    else None
                ),
                "forecasts": forecasts,
            }
        )

    payload = {
        "city_slug": city_slug,
        "city": CITIES[city_slug],
        "country": forecast_city.get(
            "country"
        ),
        "timezone_offset": forecast_city.get(
            "timezone"
        ),
        "days": days,
        "interval_hours": 3,
        "points_expected": point_count,
        "points": points,
    }

    # Avoid unbounded growth if a warm instance lives for a long time.
    if len(_validation_cache) > 25:
        _validation_cache.clear()

    _validation_cache[cache_key] = payload

    return payload


@app.after_request
def add_cors_headers(
    response,
):
    """
    The API is intentionally public/read-only.

    The GCS bucket itself remains private.
    """

    response.headers[
        "Access-Control-Allow-Origin"
    ] = "*"

    response.headers[
        "Access-Control-Allow-Methods"
    ] = "GET, OPTIONS"

    response.headers[
        "Access-Control-Allow-Headers"
    ] = "Content-Type"

    return response


@app.get("/")
def index():
    return jsonify(
        {
            "service": "weather-api",
            "status": "ok",
            "cities": list(
                CITIES.keys()
            ),
        }
    )


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok"
        }
    )


@app.get(
    "/weather/<city_slug>"
)
def weather(
    city_slug: str,
):
    if city_slug not in CITIES:
        return jsonify(
            {
                "error": "Unknown city",
                "city": city_slug,
            }
        ), 404

    try:
        current_prefix = (
            "current_weather/"
            f"{city_slug}_current_weather_"
        )

        forecast_prefix = (
            "forecast/"
            f"{city_slug}_forecast_"
        )

        current_blob = get_latest_blob(
            current_prefix
        )

        forecast_blob = get_latest_blob(
            forecast_prefix
        )

        current_data = load_json(
            current_blob
        )

        forecast_data = load_json(
            forecast_blob
        )

        forecast_city = (
            forecast_data.get(
                "city",
                {},
            )
        )

        forecast_items = (
            forecast_data.get(
                "list",
                [],
            )
        )

        normalized_forecast = [
            normalize_forecast_point(
                item
            )
            for item in forecast_items
        ]

        return jsonify(
            {
                "city_slug":
                    city_slug,

                "city":
                    CITIES[
                        city_slug
                    ],

                "country":
                    forecast_city.get(
                        "country"
                    ),

                "timezone_offset":
                    forecast_city.get(
                        "timezone"
                    ),

                "coordinates":
                    forecast_city.get(
                        "coord"
                    ),

                "current_collected_at":
                    get_collection_timestamp(
                        current_blob.name
                    ),

                "forecast_collected_at":
                    get_collection_timestamp(
                        forecast_blob.name
                    ),

                "current":
                    normalize_current(
                        current_data
                    ),

                "forecast":
                    normalized_forecast,

                "source":
                    {
                        "current_object":
                            current_blob.name,

                        "forecast_object":
                            forecast_blob.name,
                    },
            }
        )

    except FileNotFoundError as exc:
        return jsonify(
            {
                "error": str(
                    exc
                )
            }
        ), 404

    except Exception:
        app.logger.exception(
            "Unable to load weather data."
        )

        return jsonify(
            {
                "error":
                    "Unable to load weather data."
            }
        ), 500


@app.get(
    "/weather/<city_slug>/validation"
)
def weather_validation(
    city_slug: str,
):
    if city_slug not in CITIES:
        return jsonify(
            {
                "error": "Unknown city",
                "city": city_slug,
            }
        ), 404

    try:
        days = int(
            request.args.get(
                "days",
                "7",
            )
        )
    except ValueError:
        return jsonify(
            {
                "error": "days must be an integer"
            }
        ), 400

    if days < 1 or days > 14:
        return jsonify(
            {
                "error": "days must be between 1 and 14"
            }
        ), 400

    try:
        return jsonify(
            build_temperature_validation(
                city_slug,
                days,
            )
        )

    except FileNotFoundError as exc:
        return jsonify(
            {
                "error": str(exc)
            }
        ), 404

    except Exception:
        app.logger.exception(
            "Unable to build forecast validation data."
        )

        return jsonify(
            {
                "error":
                    "Unable to build forecast validation data."
            }
        ), 500


if __name__ == "__main__":
    port = int(
        os.environ.get(
            "PORT",
            "8080",
        )
    )

    app.run(
        host="0.0.0.0",
        port=port,
    )
