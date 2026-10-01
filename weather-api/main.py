import json
import os
import re

from datetime import datetime, timezone

from flask import Flask, jsonify, request
from google.cloud import storage


app = Flask(__name__)


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


storage_client = storage.Client()
COLLECTION_TIMESTAMP_PATTERN = re.compile(r"_(\d{8}T\d{6}Z)\.json$")
FORECAST_INTERVAL_SECONDS = 3 * 60 * 60
PROCESSED_PREFIX = "processed"


def get_collection_datetime(object_name: str):
    match = COLLECTION_TIMESTAMP_PATTERN.search(object_name)
    if not match:
        return None
    return datetime.strptime(
        match.group(1),
        "%Y%m%dT%H%M%SZ",
    ).replace(tzinfo=timezone.utc)


def datetime_to_iso(value: datetime):
    return value.isoformat().replace("+00:00", "Z")


def get_collection_timestamp(object_name: str):
    value = get_collection_datetime(object_name)
    return datetime_to_iso(value) if value else None


def get_latest_blob(prefix: str):
    blobs = storage_client.list_blobs(BUCKET_NAME, prefix=prefix)
    latest_blob = max(
        (blob for blob in blobs if blob.name.endswith(".json")),
        key=lambda blob: blob.name,
        default=None,
    )
    if latest_blob is None:
        raise FileNotFoundError(f"No JSON files found for prefix: {prefix}")
    return latest_blob


def load_json(blob):
    return json.loads(blob.download_as_text(encoding="utf-8"))


def normalize_current(data: dict):
    main = data.get("main") or {}
    weather_items = data.get("weather") or [{}]
    weather = weather_items[0]
    wind = data.get("wind") or {}
    clouds = data.get("clouds") or {}
    rain = data.get("rain") or {}
    snow = data.get("snow") or {}

    return {
        "timestamp": data.get("dt"),
        "temperature": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "humidity": main.get("humidity"),
        "pressure": main.get("pressure"),
        "description": weather.get("description"),
        "weather": weather.get("main"),
        "icon": weather.get("icon"),
        "wind_speed": wind.get("speed"),
        "wind_direction": wind.get("deg"),
        "wind_gust": wind.get("gust"),
        "cloud_cover": clouds.get("all"),
        "visibility": data.get("visibility"),
        "rain_1h": rain.get("1h", 0),
        "snow_1h": snow.get("1h", 0),
    }


def normalize_forecast_point(item: dict):
    main = item.get("main") or {}
    weather_items = item.get("weather") or [{}]
    weather = weather_items[0]
    wind = item.get("wind") or {}
    clouds = item.get("clouds") or {}
    rain = item.get("rain") or {}
    snow = item.get("snow") or {}
    rain_3h = rain.get("3h", 0) or 0
    snow_3h = snow.get("3h", 0) or 0

    return {
        "timestamp": item.get("dt"),
        "temperature": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "humidity": main.get("humidity"),
        "weather": weather.get("main"),
        "description": weather.get("description"),
        "wind_speed": wind.get("speed"),
        "cloud_cover": clouds.get("all"),
        "pop": item.get("pop", 0) or 0,
        "rain_3h": rain_3h,
        "snow_3h": snow_3h,
        "precipitation_3h": rain_3h + snow_3h,
    }


def load_processed_city(city_slug: str):
    object_name = f"{PROCESSED_PREFIX}/{city_slug}.json"
    blob = storage_client.bucket(BUCKET_NAME).blob(object_name)
    if not blob.exists():
        raise FileNotFoundError(
            f"Processed weather file not found: {object_name}. "
            "Run the validation backfill first."
        )
    return load_json(blob)


def load_current_weather_snapshot():
    blob = storage_client.bucket(
        BUCKET_NAME
    ).blob(
        "processed/current.json"
    )

    if not blob.exists():
        raise FileNotFoundError(
            "processed/current.json not found."
        )

    return load_json(blob)


def validation_forecast_payload(days_ahead: int, stored):
    if not stored:
        return {
            "days_ahead": days_ahead,
            "temperature": None,
            "feels_like": None,
            "humidity": None,
            "wind_speed": None,
            "cloud_cover": None,
            "weather_main": None,
            "weather_description": None,
            "probability_of_precipitation": None,
            "rain_3h": None,
            "snow_3h": None,
            "precipitation_3h": None,
            "collected_at": None,
            "lead_hours": None,
        }

    return {
        "days_ahead": days_ahead,
        "temperature": stored.get("temperature"),
        "feels_like": stored.get("feels_like"),
        "humidity": stored.get("humidity"),
        "wind_speed": stored.get("wind_speed"),
        "cloud_cover": stored.get("cloud_cover"),
        "weather_main": stored.get("weather_main"),
        "weather_description": stored.get("weather_description"),
        "probability_of_precipitation": stored.get(
            "probability_of_precipitation"
        ),
        "rain_3h": stored.get("rain_3h"),
        "snow_3h": stored.get("snow_3h"),
        "precipitation_3h": stored.get("precipitation_3h"),
        "collected_at": stored.get("collected_at"),
        "lead_hours": stored.get("lead_hours"),
    }


def validation_point_payload(point: dict):
    actual = point.get("actual") or {}
    actual_precipitation = actual.get("precipitation_3h")

    forecasts = point.get("forecasts") or {}

    return {
        "timestamp": point.get("timestamp"),
        "actual_temperature": actual.get("temperature"),
        "actual_feels_like": actual.get("feels_like"),
        "actual_humidity": actual.get("humidity"),
        "actual_wind_speed": actual.get("wind_speed"),
        "actual_cloud_cover": actual.get("cloud_cover"),
        "actual_weather_main": actual.get("weather_main"),
        "actual_weather_description": actual.get("weather_description"),
        "actual_rain_3h": actual.get("rain_3h"),
        "actual_snow_3h": actual.get("snow_3h"),
        "actual_precipitation_3h": actual_precipitation,
        "actual_precipitation_occurred": (
            actual_precipitation > 0
            if actual_precipitation is not None
            else None
        ),
        "actual_observed_at": actual.get("observed_at"),
        "forecasts": [
            validation_forecast_payload(
                days_ahead,
                forecasts.get(f"{days_ahead}d"),
            )
            for days_ahead in range(1, 6)
        ],
    }


def build_validation_response(city_slug: str, days: int):
    document = load_processed_city(city_slug)
    points = sorted(
        document.get("points") or [],
        key=lambda point: point.get("timestamp", 0),
    )

    points_with_actual = [
        point
        for point in points
        if point.get("actual") is not None
    ]

    if not points_with_actual:
        raise FileNotFoundError(
            f"No completed validation observations found for {city_slug}."
        )

    target_end = int(points_with_actual[-1]["timestamp"])
    point_count = days * 8
    target_start = target_end - (point_count - 1) * FORECAST_INTERVAL_SECONDS

    selected = [
        point
        for point in points
        if target_start <= int(point.get("timestamp", 0)) <= target_end
    ]

    return {
        "city_slug": city_slug,
        "city": document.get("city") or CITIES[city_slug],
        "country": document.get("country"),
        "timezone_offset": document.get("timezone_offset"),
        "updated_at": document.get("updated_at"),
        "days": days,
        "interval_hours": 3,
        "points_expected": point_count,
        "points": [validation_point_payload(point) for point in selected],
    }


@app.after_request
def add_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"

    # The collector runs hourly. Reusing the same response for a few minutes
    # substantially reduces repeat traffic without making the UI stale.
    if request.method == "GET":
        response.headers["Cache-Control"] = (
            "public, max-age=300, stale-while-revalidate=3600"
        )
    return response


@app.get("/")
def index():
    return jsonify(
        {
            "service": "weather-api",
            "status": "ok",
            "cities": list(CITIES.keys()),
        }
    )


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/weather/current")
def weather_current():
    try:
        return jsonify(
            load_current_weather_snapshot()
        )

    except FileNotFoundError as exc:
        return jsonify(
            {"error": str(exc)}
        ), 404

    except Exception:
        app.logger.exception(
            "Unable to load current weather snapshot."
        )
        return jsonify(
            {
                "error":
                "Unable to load current weather snapshot."
            }
        ), 500

# Keep the existing current-weather endpoint unchanged during migration.
# This lets the homepage continue to use the raw latest current/forecast files
# until we explicitly switch that endpoint to processed/<city>.json later.
@app.get("/weather/<city_slug>")
def weather(city_slug: str):
    if city_slug not in CITIES:
        return jsonify({"error": "Unknown city", "city": city_slug}), 404

    try:
        current_prefix = f"current_weather/{city_slug}_current_weather_"
        forecast_prefix = f"forecast/{city_slug}_forecast_"

        current_blob = get_latest_blob(current_prefix)
        forecast_blob = get_latest_blob(forecast_prefix)

        current_data = load_json(current_blob)
        forecast_data = load_json(forecast_blob)
        forecast_city = forecast_data.get("city") or {}

        return jsonify(
            {
                "city_slug": city_slug,
                "city": CITIES[city_slug],
                "country": forecast_city.get("country"),
                "timezone_offset": forecast_city.get("timezone"),
                "coordinates": forecast_city.get("coord"),
                "current_collected_at": get_collection_timestamp(
                    current_blob.name
                ),
                "forecast_collected_at": get_collection_timestamp(
                    forecast_blob.name
                ),
                "current": normalize_current(current_data),
                "forecast": [
                    normalize_forecast_point(item)
                    for item in forecast_data.get("list", [])
                ],
                "source": {
                    "current_object": current_blob.name,
                    "forecast_object": forecast_blob.name,
                },
            }
        )

    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception:
        app.logger.exception("Unable to load weather data.")
        return jsonify({"error": "Unable to load weather data."}), 500


@app.get("/weather/<city_slug>/validation")
def weather_validation(city_slug: str):
    if city_slug not in CITIES:
        return jsonify({"error": "Unknown city", "city": city_slug}), 404

    try:
        days = int(request.args.get("days", "7"))
    except ValueError:
        return jsonify({"error": "days must be an integer"}), 400

    if days < 1 or days > 3650:
        return jsonify({"error": "days must be between 1 and 3650"}), 400

    try:
        return jsonify(build_validation_response(city_slug, days))
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception:
        app.logger.exception("Unable to load forecast validation data.")
        return jsonify({"error": "Unable to load forecast validation data."}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)
