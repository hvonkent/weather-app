import json
import os
import time
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from google.cloud import storage

from collector_integration import process_city_collection


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

CITY_NAMES = {
    "bremen": "Bremen",
    "munich": "Munich",
    "amsterdam": "Amsterdam",
    "rochester_mn": "Rochester",
    "boston_ma": "Boston",
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


def create_collection_time():
    return datetime.now(timezone.utc)


def format_collection_timestamp(
    collected_at,
):
    return collected_at.strftime(
        "%Y%m%dT%H%M%SZ"
    )

# ============================================================
# Compact current-weather snapshot for homepage
# ============================================================

def datetime_to_iso(value):
    return (
        value.astimezone(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z")
    )


def normalize_homepage_current(
    city_slug,
    data,
    collected_at,
):
    main = data.get("main") or {}

    weather_items = data.get("weather") or []
    weather = weather_items[0] if weather_items else {}

    wind = data.get("wind") or {}
    sys_data = data.get("sys") or {}

    return {
        "city": CITY_NAMES.get(city_slug, data.get("name") or city_slug,),
        "country": sys_data.get("country"),
        "timezone_offset": data.get("timezone"),

        "observed_at": data.get("dt"),
        "collected_at": datetime_to_iso(collected_at),

        "temperature": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "humidity": main.get("humidity"),

        "wind_speed": wind.get("speed"),

        "weather_main": weather.get("main"),
        "weather_description": weather.get("description"),
        "weather_icon": weather.get("icon"),
    }


def update_current_snapshot(
    current_results,
    collected_at,
):
    """
    Update processed/current.json.

    This object contains only the latest current-weather
    values needed by the homepage.

    Existing city entries are preserved if one city's
    current-weather request fails during a collection run.
    """

    bucket_name = get_bucket_name()

    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)

    blob = bucket.blob("processed/current.json")

    # Start with the previous snapshot if one already exists.
    # That way a temporary failure for one city does not make
    # that city disappear from the homepage.
    document = {
        "schema_version": 1,
        "updated_at": None,
        "units": {
            "temperature": "C",
            "humidity": "%",
            "wind_speed": "m/s",
        },
        "cities": {},
    }

    if blob.exists():
        try:
            existing = json.loads(
                blob.download_as_text(
                    encoding="utf-8"
                )
            )

            if isinstance(existing, dict):
                document.update(existing)

            if not isinstance(
                document.get("cities"),
                dict,
            ):
                document["cities"] = {}

        except Exception as error:
            print(
                "Could not read existing "
                f"processed/current.json: {error}"
            )

    updated_count = 0

    for city_slug in CITIES:
        current_data = current_results.get(city_slug)

        if current_data is None:
            print(
                f"Keeping previous current snapshot "
                f"for {city_slug}: "
                "new current weather is missing."
            )
            continue

        document["cities"][city_slug] = (
            normalize_homepage_current(
                city_slug=city_slug,
                data=current_data,
                collected_at=collected_at,
            )
        )

        updated_count += 1

    if updated_count == 0:
        print(
            "No current-weather results available; "
            "processed/current.json was not changed."
        )
        return document

    document["schema_version"] = 1
    document["updated_at"] = datetime_to_iso(
        collected_at
    )

    blob.upload_from_string(
        json.dumps(
            document,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        content_type="application/json",
    )

    print(
        "Updated processed/current.json "
        f"({updated_count} cities refreshed)"
    )

    return document

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

    results = {}

    for city, coordinates in CITIES.items():

        print(
            f"Fetching current weather for {city}..."
        )

        try:
            data = fetch_current_weather(
                latitude=coordinates["latitude"],
                longitude=coordinates["longitude"],
            )

            results[city] = data

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

    return results


# ============================================================
# Forecast collection
# ============================================================

def run_forecast_for_all_cities(
    timestamp,
):
    print("\nFetching forecasts...")

    results = {}

    for city, coordinates in CITIES.items():

        print(
            f"Fetching forecast for {city}..."
        )

        try:
            data = fetch_forecast(
                latitude=coordinates["latitude"],
                longitude=coordinates["longitude"],
            )

            results[city] = data

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

    return results


# ============================================================
# Compact validation data
# ============================================================

def update_compact_validation_for_all_cities(
    current_results,
    forecast_results,
    collected_at,
):
    print("\nUpdating compact validation data...")

    for city in CITIES:
        current_data = current_results.get(city)
        forecast_data = forecast_results.get(city)

        if current_data is None:
            print(
                f"Skipping compact validation for {city}: "
                "current weather is missing."
            )
            continue

        if forecast_data is None:
            print(
                f"Skipping compact validation for {city}: "
                "forecast is missing."
            )
            continue

        forecast_city = forecast_data.get("city") or {}

        city_name = (
            forecast_city.get("name")
            or current_data.get("name")
            or city
        )

        try:
            document = process_city_collection(
                bucket_name=get_bucket_name(),
                city_slug=city,
                city_name=city_name,
                current_data=current_data,
                forecast_data=forecast_data,
                collected_at=collected_at,
            )

            print(
                f"Updated processed/{city}.json "
                f"({len(document.get('points', []))} points)"
            )

        except Exception as error:
            print(
                f"Could not update compact validation "
                f"for {city}: {error}"
            )


# ============================================================
# One complete collection cycle
# ============================================================

def run_collection_cycle(
    run_number,
    total_runs,
):
    collected_at = create_collection_time()
    timestamp = format_collection_timestamp(
        collected_at
    )

    print("\n" + "=" * 60)
    print(
        f"Weather collection "
        f"{run_number}/{total_runs}"
    )
    print(f"Run timestamp: {timestamp}")
    print("=" * 60)

    current_results = (
        run_current_weather_for_all_cities(
            timestamp=timestamp
        )
    )

    update_current_snapshot(
    current_results=current_results,
    collected_at=collected_at,
)

    forecast_results = (
        run_forecast_for_all_cities(
            timestamp=timestamp
        )
    )

    update_compact_validation_for_all_cities(
        current_results=current_results,
        forecast_results=forecast_results,
        collected_at=collected_at,
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
