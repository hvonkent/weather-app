# Operations / Deployment Handoff

This document contains the non-secret infrastructure information needed to resume development, inspect the live system, or redeploy **Weather Forecast Validation (WFV)**.

Do not put secret values, service-account credentials, private keys, or access tokens in this file.

## Production overview

WFV consists of:

- an Expo / React Native Web frontend;
- a Flask API running on Google Cloud Run;
- a scheduled collector running as a Google Cloud Run Job;
- Google Cloud Storage for compact processed weather data;
- Google Secret Manager for the OpenWeather API key.

The production system does not depend on any irreplaceable local files.

## Google Cloud

### Project

Project ID:

`weatherapp-506216`

Primary region:

`us-central1`

Confirm the active Google Cloud project:

```powershell
gcloud config get-value project
```

Set it explicitly if needed:

```powershell
gcloud config set project weatherapp-506216
```

## Google Cloud Storage

Production bucket:

`gs://weatherapp-506216-weather-data-01`

The production bucket contains compact processed application data under:

```text
processed/
├── current.json
├── amsterdam.json
├── boston_ma.json
├── bremen.json
├── munich.json
└── rochester_mn.json
```

`processed/current.json` contains the latest current-weather snapshot for all configured cities and is used by the homepage.

`processed/<city>.json` contains compact validation history for each city, including observed weather and forecasts made approximately 1–5 days earlier.

Raw timestamped OpenWeather responses are not retained in the production bucket.

Inspect the production bucket with:

```powershell
gcloud storage ls -l `
    gs://weatherapp-506216-weather-data-01/processed/
```

## Google Secret Manager

The production OpenWeather API key is stored in Google Secret Manager.

Secret name:

`OPENWEATHER_API_KEY`

The secret value must never be committed to GitHub.

List secrets without exposing their values:

```powershell
gcloud secrets list `
    --project weatherapp-506216
```

The collector receives `OPENWEATHER_API_KEY` from Secret Manager at runtime.

## Cloud Run API

Cloud Run service:

`weather-api`

Region:

`us-central1`

Canonical Cloud Run URL:

`https://weather-api-955402373819.us-central1.run.app`

The frontend currently uses this compatible Cloud Run URL:

`https://weather-api-2dpn2xfagq-uc.a.run.app`

The API is intentionally public and read-only.

Inspect the service:

```powershell
gcloud run services describe weather-api `
    --region us-central1 `
    --project weatherapp-506216
```

### Current production API routes

Current weather for all cities:

```text
GET /weather/current
```

Forecast validation:

```text
GET /weather/<city_slug>/validation?days=<days>
```

Examples:

```text
/weather/amsterdam/validation?days=3
/weather/munich/validation?days=7
/weather/boston_ma/validation?days=14
```

The current frontend uses only the compact processed-data routes above.

The backend may still contain older migration-era code that references the deleted raw `current_weather/` and `forecast/` storage prefixes. That code is not part of the current frontend data path and can be cleaned up later.

## Cloud Run collector

Cloud Run Job:

`weather-collector`

Region:

`us-central1`

The job uses the environment variable:

```text
WEATHER_BUCKET=weatherapp-506216-weather-data-01
```

and receives:

```text
OPENWEATHER_API_KEY
```

from Secret Manager.

Inspect the job:

```powershell
gcloud run jobs describe weather-collector `
    --region us-central1 `
    --project weatherapp-506216
```

Run the collector manually:

```powershell
gcloud run jobs execute weather-collector `
    --region us-central1 `
    --project weatherapp-506216 `
    --wait
```

### Collector behavior

Each collection run fetches:

- current weather for all configured cities;
- OpenWeather 5-day / 3-hour forecasts for all configured cities.

The responses are processed in memory.

The collector updates:

```text
processed/current.json
processed/amsterdam.json
processed/boston_ma.json
processed/bremen.json
processed/munich.json
processed/rochester_mn.json
```

The collector does **not** create permanent per-run raw files under `current_weather/` or `forecast/`.

Do not reintroduce raw timestamped GCS storage unless the storage architecture is intentionally being changed.

## Collection schedule

The collector is intended to run hourly at minute 59 UTC:

```text
59 * * * *
```

Cloud Scheduler triggers the `weather-collector` Cloud Run Job.

To inspect scheduler jobs:

```powershell
gcloud scheduler jobs list `
    --project weatherapp-506216
```

## Configured cities

The application currently supports:

- Amsterdam
- Bremen
- Munich
- Rochester, Minnesota
- Boston, Massachusetts

City slugs:

```text
amsterdam
bremen
munich
rochester_mn
boston_ma
```

## Frontend

The frontend is an Expo / React Native Web application.

Production site:

`https://hvonkent-weather-app.expo.app`

Frontend API configuration is read from:

`EXPO_PUBLIC_WEATHER_API_URL`

The production API base URL currently used by the frontend is:

`https://weather-api-2dpn2xfagq-uc.a.run.app`

This URL is public configuration, not a secret.

## GitHub

Public repository:

`https://github.com/hvonkent/weather-app`

The repository contains source code, public assets, deployment configuration, and documentation.

It must not contain:

- `.env` files with real secrets;
- OpenWeather API key values;
- Google service-account JSON files;
- private keys;
- access tokens;
- local raw weather archives;
- generated dependency folders such as `node_modules/`;
- generated Expo output such as `dist/`.

## Recreating a local development environment

Clone the repository:

```powershell
git clone https://github.com/hvonkent/weather-app.git
cd weather-app
```

Install JavaScript dependencies:

```powershell
npm install
```

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

For frontend development against the deployed backend, set:

```text
EXPO_PUBLIC_WEATHER_API_URL=https://weather-api-2dpn2xfagq-uc.a.run.app
```

A local OpenWeather API key is not required if the frontend is using the deployed API.

Start the Expo web app:

```powershell
npx expo start --web
```

## Local files that are disposable

The following local paths are ignored or generated and can be recreated:

```text
.expo/
dist/
node_modules/
```

The local `.env` file is also ignored and is not stored in GitHub.

Production secrets and runtime configuration are stored separately in Google Cloud.

## Frontend deployment

A Git push does not deploy the Expo production site.

Export the web app first:

```powershell
npx expo export --platform web
```

Only if the export succeeds, deploy:

```powershell
eas deploy --prod
```

Production site:

`https://hvonkent-weather-app.expo.app`

## API deployment

From the repository root:

```powershell
gcloud run deploy weather-api `
    --source .\weather-api `
    --region us-central1 `
    --project weatherapp-506216
```

After deployment, verify:

```text
GET /health
GET /weather/current
GET /weather/amsterdam/validation?days=3
```

## Collector deployment

From the repository root:

```powershell
gcloud run jobs deploy weather-collector `
    --source .\weather-job `
    --region us-central1 `
    --project weatherapp-506216
```

After deployment, execute one manual run:

```powershell
gcloud run jobs execute weather-collector `
    --region us-central1 `
    --project weatherapp-506216 `
    --wait
```

Then confirm that the processed files have recent timestamps:

```powershell
gcloud storage ls -l `
    gs://weatherapp-506216-weather-data-01/processed/
```

The collector should update the six processed JSON files without recreating `current_weather/` or `forecast/`.

## Useful production checks

Check the API service:

```powershell
gcloud run services describe weather-api `
    --region us-central1 `
    --project weatherapp-506216
```

Check the collector job:

```powershell
gcloud run jobs describe weather-collector `
    --region us-central1 `
    --project weatherapp-506216
```

Check Scheduler:

```powershell
gcloud scheduler jobs list `
    --project weatherapp-506216
```

Check processed storage:

```powershell
gcloud storage ls -l `
    gs://weatherapp-506216-weather-data-01/processed/
```

Check available secrets without revealing values:

```powershell
gcloud secrets list `
    --project weatherapp-506216
```

## Public-repository safety

The following infrastructure identifiers are not secrets and may appear in this repository:

- Google Cloud project ID;
- GCS bucket name;
- Cloud Run service and job names;
- Google Cloud region;
- public Cloud Run API URL;
- public Expo URL;
- Secret Manager secret **name**.

The following must never be committed:

- the value of `OPENWEATHER_API_KEY`;
- Google service-account credentials;
- private keys;
- access tokens;
- real secret-bearing `.env` files.

## Recovery summary

If the local development machine is lost or the project directory is deleted:

1. Clone the source from GitHub.
2. Run `npm install`.
3. Recreate `.env` from `.env.example`.
4. Use the deployed public API URL for frontend development.
5. Authenticate `gcloud` to the Google account with access to project `weatherapp-506216`.
6. Production secrets remain in Google Secret Manager.
7. Production processed weather data remains in Google Cloud Storage.
8. The API and collector remain deployed in Cloud Run.
9. The frontend remains deployed through Expo/EAS.

No local raw-weather archive is required for normal operation.
