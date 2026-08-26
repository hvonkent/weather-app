import json
import os
import re

from datetime import datetime, timezone

from flask import Flask, jsonify
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


def get_collection_timestamp(
    object_name: str,
):
    """
    Convert a filename timestamp like:

    20260825T180230Z

    into:

    2026-08-25T18:02:30Z
    """

    match = COLLECTION_TIMESTAMP_PATTERN.search(
        object_name
    )

    if not match:
        return None

    timestamp_text = match.group(1)

    timestamp = datetime.strptime(
        timestamp_text,
        "%Y%m%dT%H%M%SZ",
    ).replace(
        tzinfo=timezone.utc
    )

    return (
        timestamp
        .isoformat()
        .replace("+00:00", "Z")
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