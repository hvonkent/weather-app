import json
import os
import time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from google.cloud import storage


# ============================================================
# Configuration
# ============================================================

load_dotenv()

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
WEATHER_BUCKET = os.getenv("WEATHER_BUCKET")

CURRENT_WEATHER_URL = (
    "https://api.openweathermap.org/data/2.5/weather"
)

FORECAST_URL = (
    "https://api.openweathermap.org/data/2.5/forecast"
)


CITIES = {
    "bremen": {
        "latitude": 53.0758,
        "longitude": 8.8072,
    },
    "munich": {
        "latitude": 48.1374,
        "longitude": 11.5755,
    },
    "amsterdam": {
        "latitude": 52.3740,
        "longitude": 4.8897,
    },
    "rochester_mn": {
        "latitude": 44.0216,
        "longitude": -92.4699,
    },
    "boston_ma": {
        "latitude": 42.3584,
        "longitude": -71.0598,
    },
}


# ============================================================
# Configuration helpers
# ============================================================

def get_api_key():
    if not OPENWEATHER_API_KEY:
        raise RuntimeError(
            "OPENWEATHER_API_KEY is not set."
        )

    return OPENWEATHER_API_KEY


def get_bucket_name():
    if not WEATHER_BUCKET:
        raise RuntimeError(
            "WEATHER_BUCKET is not set."
        )

    return WEATHER_BUCKET


def create_timestamp():
    return datetime.now(
        timezone.utc
    ).strftime("%Y%m%dT%H%M%SZ")


# ============================================================
# OpenWeather API
# ============================================================

def make_api_request(
    url,
    latitude,
    longitude,
):
    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": get_api_key(),
        "units": "metric",
    }

    response = requests.get(
        url,
        params=params,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()


def fetch_current_weather(
    latitude,
    longitude,
):
    return make_api_request(
        url=CURRENT_WEATHER_URL,
        latitude=latitude,
        longitude=longitude,
    )


def fetch_forecast(
    latitude,
    longitude,
):
    return make_api_request(
        url=FORECAST_URL,
        latitude=latitude,
        longitude=longitude,
    )


# ============================================================
# Google Cloud Storage
# ============================================================

def save_json_to_cloud_storage(
    data,
    city,
    data_type,
    timestamp,
):
    storage_client = storage.Client()

    bucket = storage_client.bucket(
        get_bucket_name()
    )

    filename = (
        f"{city}_{data_type}_{timestamp}.json"
    )

    cloud_path = (
        f"{data_type}/{filename}"
    )

    blob = bucket.blob(cloud_path)

    json_string = json.dumps(
        data,
        indent=4,
        ensure_ascii=False,
    )

    blob.upload_from_string(
        json_string,
        content_type="application/json",
    )

    print(
        f"Saved: gs://{get_bucket_name()}/{cloud_path}"
    )


# ============================================================
# Current weather collection
# ============================================================

def run_current_weather_for_all_cities(
    timestamp,
):
    print("\nFetching current weather...")

    for city, coordinates in CITIES.items():

        print(
            f"Fetching current weather for {city}..."
        )

        try:
            data = fetch_current_weather(
                latitude=coordinates["latitude"],
                longitude=coordinates["longitude"],
            )

            save_json_to_cloud_storage(
                data=data,
                city=city,
                data_type="current_weather",
                timestamp=timestamp,
            )

        except requests.RequestException as error:
            print(
                f"Current weather request failed "
                f"for {city}: {error}"
            )

        except Exception as error:
            print(
                f"Could not process current weather "
                f"for {city}: {error}"
            )


# ============================================================
# Forecast collection
# ============================================================

def run_forecast_for_all_cities(
    timestamp,
):
    print("\nFetching forecasts...")

    for city, coordinates in CITIES.items():

        print(
            f"Fetching forecast for {city}..."
        )

        try:
            data = fetch_forecast(
                latitude=coordinates["latitude"],
                longitude=coordinates["longitude"],
            )

            save_json_to_cloud_storage(
                data=data,
                city=city,
                data_type="forecast",
                timestamp=timestamp,
            )

        except requests.RequestException as error:
            print(
                f"Forecast request failed "
                f"for {city}: {error}"
            )

        except Exception as error:
            print(
                f"Could not process forecast "
                f"for {city}: {error}"
            )


# ============================================================
# One complete collection cycle
# ============================================================

def run_collection_cycle(
    run_number,
    total_runs,
):
    timestamp = create_timestamp()

    print("\n" + "=" * 60)
    print(
        f"Weather collection "
        f"{run_number}/{total_runs}"
    )
    print(f"Run timestamp: {timestamp}")
    print("=" * 60)

    run_current_weather_for_all_cities(
        timestamp=timestamp
    )

    run_forecast_for_all_cities(
        timestamp=timestamp
    )

    print("\n" + "=" * 60)
    print(
        f"Collection "
        f"{run_number}/{total_runs} complete"
    )
    print("=" * 60)


# ============================================================
# Main
# ============================================================

def main():
    """
    Normal production behavior:
        COLLECTION_RUNS defaults to 1.

    Test behavior:
        COLLECTION_RUNS=5
        COLLECTION_INTERVAL_SECONDS=60

    That gives approximately:

        run 1: 08:58
        run 2: 08:59
        run 3: 09:00
        run 4: 09:01
        run 5: 09:02
    """

    total_runs = int(
        os.getenv(
            "COLLECTION_RUNS",
            "1",
        )
    )

    interval_seconds = float(
        os.getenv(
            "COLLECTION_INTERVAL_SECONDS",
            "0",
        )
    )

    print("=" * 60)
    print("Weather collector started")
    print(f"Number of runs: {total_runs}")
    print(
        f"Interval: {interval_seconds} seconds"
    )
    print("=" * 60)

    start_time = time.monotonic()

    for index in range(total_runs):

        run_number = index + 1

        if index > 0:

            target_time = (
                start_time
                + index * interval_seconds
            )

            wait_seconds = (
                target_time
                - time.monotonic()
            )

            if wait_seconds > 0:
                print(
                    f"\nWaiting "
                    f"{wait_seconds:.1f} seconds "
                    f"until collection "
                    f"{run_number}..."
                )

                time.sleep(
                    wait_seconds
                )

        run_collection_cycle(
            run_number=run_number,
            total_runs=total_runs,
        )

    print("\n" + "=" * 60)
    print("Weather collector finished")
    print("=" * 60)


if __name__ == "__main__":
    main()
