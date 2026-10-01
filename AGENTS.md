# AGENTS.md

## Purpose

This file is the zero-context handoff for coding agents working on **Weather Forecast Validation (WFV)**.

WFV is a production weather-data pipeline plus an Expo / React Native Web PWA. Its defining feature is **historical forecast validation**: forecasts made 1–5 days earlier are preserved in compact per-city validation documents so they can later be compared with observed weather.

Do not simplify the project into a latest-weather-only app. Preserving the 1–5 day forecast history needed for validation is a core requirement.

## High-level architecture

```text
Cloud Scheduler
      |
      v
Cloud Run Job: weather-collector
      |
      +--> OpenWeather API
      |
      v
Google Cloud Storage
      |
      +--> processed/current.json
      |
      +--> processed/<city>.json
      |
      v
Cloud Run API: weather-api (public/read-only)
      |
      v
Expo / React Native Web PWA
```

The GCS bucket is private. The browser reads weather data through `weather-api`; it does not read GCS directly.

Runtime does not depend on Firebase Auth, Firestore, or Gemini.

## Current storage model

The production bucket intentionally contains only compact processed application data:

```text
processed/
├── current.json
├── amsterdam.json
├── boston_ma.json
├── bremen.json
├── munich.json
└── rochester_mn.json
```

`processed/current.json` is the latest homepage snapshot for all configured cities and is overwritten on each successful collection cycle.

Each `processed/<city>.json` stores the compact validation history for that city. It includes 1–5 day forecast horizons, observed values as they become available, and short-lived internal observation state used by the collector.

The collector still fetches both current weather and the OpenWeather 5-day / 3-hour forecast every run, but raw OpenWeather responses are processed in memory and are **not permanently archived in GCS**.

Do not reintroduce timestamped raw `current_weather/` or `forecast/` GCS archives unless the storage architecture is intentionally being changed. Do not replace the compact city history with a latest-forecast-only document.

A local `data/` directory may contain a backup of historical raw files. It is local recovery data, is ignored by Git, and must never be committed.

## Configured cities

The current application supports:

- Amsterdam
- Bremen
- Munich
- Rochester, Minnesota
- Boston, Massachusetts

Frontend IANA time zones:

```ts
const CITY_TIME_ZONES: Record<string, string> = {
  amsterdam: "Europe/Amsterdam",
  bremen: "Europe/Berlin",
  munich: "Europe/Berlin",
  rochester_mn: "America/Chicago",
  boston_ma: "America/New_York",
};
```

Never replace these with fixed UTC offsets. DST must be handled by the IANA time-zone database.

## Public-repository safety

This repository may be public.

Never commit or print:

- OpenWeather API keys;
- Google service-account JSON files;
- private keys or downloaded credentials;
- `.env` files containing secrets;
- access tokens;
- local raw-weather backups under `data/`.

The OpenWeather key belongs in Google Secret Manager. The storage bucket is private. The API is intentionally public/read-only.

`.env.example` may be committed, but it must contain placeholders only.

Operational IDs and public service URLs are not application secrets, but avoid adding unnecessary production infrastructure identifiers to documentation or logs.

## Scheduled collection

The collector is intended to run hourly at minute 59 UTC:

```cron
59 * * * *
```

Each run fetches:

- current weather;
- OpenWeather 5-day / 3-hour forecast;
- all configured cities.

The fetched responses are processed in memory. A successful run should:

- update `processed/current.json`;
- update each `processed/<city>.json`;
- preserve existing compact forecast history;
- avoid creating new timestamped raw GCS objects.

## Validation methodology

The current UI exposes:

```text
3 days | 7 days | 14 days
```

Default: **3 days**.

The validation API supports a broader `days` parameter than the UI. Do not assume the UI options are the backend limit.

Validation target times are spaced every 3 hours.

For each target timestamp, the compact validation data associates:

- the closest observed/current-weather measurement;
- the forecast corresponding to roughly 24 hours before the target;
- the forecast corresponding to roughly 48 hours before the target;
- the forecast corresponding to roughly 72 hours before the target;
- the forecast corresponding to roughly 96 hours before the target;
- the forecast corresponding to roughly 120 hours before the target.

These become forecast horizons 1–5 days ahead.

The collector / validation-store code builds and maintains these associations. The API primarily reads the processed city document and returns the requested history window.

Keep matching and storage logic in UTC. Convert to city-local time only for display.

## Current API usage

The frontend should use these routes:

```text
GET /weather/current
GET /weather/<city_slug>/validation?days=N
```

The homepage should make one `/weather/current` request for all cities.

City validation pages should use only the validation endpoint for their requested history window.

A legacy `GET /weather/<city_slug>` route may still exist in backend code from the pre-migration architecture. Do not build new frontend code against it. It depended on raw GCS prefixes that are no longer part of the production storage model and can be removed in a later cleanup.

## Validation metrics

Current `ValidationMetricKey` values:

```ts
export type ValidationMetricKey =
  | "temperature"
  | "feels_like"
  | "humidity"
  | "wind_speed"
  | "cloud_cover"
  | "probability_of_precipitation"
  | "precipitation_3h";
```

The validation page presents each metric as an expandable section. Temperature starts expanded. Multiple sections may be open simultaneously.

Each expanded metric contains:

1. observed-vs-forecast chart;
2. performance heatmap;
3. summary metric table.

Continuous metrics use absolute error / MAE. Probability of precipitation uses Brier error / Brier score.

## Unit systems

`UnitSystem` is:

```ts
export type UnitSystem = "metric" | "imperial";
```

Default: **metric**.

The backend/storage representation remains metric. Unit switching is a frontend-only conversion and must not trigger duplicate OpenWeather requests or a validation API reload.

Conversions:

```text
°C -> °F        F = C * 9 / 5 + 32
Δ°C -> Δ°F      ΔF = ΔC * 9 / 5
m/s -> mph      * 2.2369362920544
mm -> in        / 25.4
```

Humidity, cloud cover, probabilities, and Brier values remain unchanged.

Display conventions:

```text
Metric:
  °C
  m/s
  mm
  DD/MM/YYYY
  24-hour times such as 17h

Imperial:
  °F
  mph
  in
  MM/DD/YYYY
  12-hour times such as 5pm
```

Temperature y-axis labels must explicitly include `°C` or `°F`.

## Frontend structure

Important current files:

```text
src/app/index.tsx
src/app/city/[city].tsx
src/components/ValidationMetricChart.tsx
src/components/ValidationPerformanceMetrics.tsx
src/components/validationMetrics.ts
src/services/weatherApi.ts
src/utils/dateTime.ts
src/app/+html.tsx
public/manifest.json
```

Brand assets:

```text
assets/images/wfv-mark.png
assets/images/icon.png
assets/images/adaptive-icon.png
assets/images/favicon.png
```

Legacy components such as `TemperatureChart.tsx` and `PerformanceMetricsChart.tsx` have been superseded by the generic validation components. Do not build new work on the legacy components unless the checked-out code clearly requires it.

## Homepage behavior

The homepage is a current-weather summary, not the historical validation dashboard.

Branding:

```text
Weather Forecast Validation
Observed weather vs. forecasts made 1–5 days earlier
```

The visible brand uses the WFV monogram and orange theme.

Each city card shows current conditions and links to the city-specific `Forecast Validation` page.

The homepage should load all configured cities from a single current-weather API response rather than issuing one weather request per city.

Do not move the historical charts onto the homepage unless explicitly requested.

## Validation page behavior

Top controls:

```text
History                         Display
[ 3 days ] [ 7 days ] [ 14 days ]   [ Metric ] [ Imperial ]
```

Changing history reloads validation data. Changing unit system does not.

The page uses accordion-style metric sections to avoid showing all charts simultaneously.

## Chart invariants

`ValidationMetricChart.tsx` and `ValidationPerformanceMetrics.tsx` share important layout behavior.

### Forecast/actual colors

Observed/actual series:

```ts
const ACTUAL_COLOR = "#f97316";
```

Forecast horizons remain blue because they encode data series rather than app branding:

```text
1d  #2563eb  radius 5
2d  #3b82f6  radius 4.5
3d  #60a5fa  radius 4
4d  #93c5fd  radius 3.5
5d  #bfdbfe  radius 3
```

Do not turn the forecast horizon colors orange merely to match the theme.

### X-axis cadence

Critical invariant:

- validation point every 3 hours;
- tick/dash at every point;
- text label at every other point = every 6 hours.

Representative implementation:

```ts
const xAxisLabelPoints = data.filter((_, index) => index % 2 === 0);
```

Do not reduce the tick cadence when modifying chart density or responsiveness.

### Date boundaries

- local-midnight separators are dashed vertical lines;
- day labels are centered within each local-day segment;
- the first partial-day label is intentionally shown;
- use city-local IANA time zones for boundaries and labels.

### Fixed visual width

The 3-, 7-, and 14-day views intentionally use the same horizontal plot width. Shorter history windows spread their points over the same plot extent.

Current concept:

```ts
const HOUR_WIDTH = 4;
const FIXED_HISTORY_DAYS = 14;
const FIXED_PLOT_WIDTH = FIXED_HISTORY_DAYS * 24 * HOUR_WIDTH;
```

The timestamp range is normalized across `FIXED_PLOT_WIDTH` rather than multiplying the selected history duration by `HOUR_WIDTH`.

The performance heatmap must match the main graph width.

### Initial scroll position

Both horizontally scrollable validation visualizations intentionally open at the **rightmost/latest data**.

They use a `ScrollView` ref and `scrollToEnd({ animated: false })` after content/data changes. Preserve this behavior when refactoring.

### Responsive breakpoint

Current compact breakpoint:

```ts
const compact = viewportWidth < 720;
```

## Theme and branding

Primary app accent:

```text
#f97316
```

Warm heatmap palette:

```text
#fff7ed
#ffedd5
#fed7aa
#fdba74
#fb923c
#ea580c
#9a3412
```

The old purple theme should not be reintroduced.

PWA branding:

- full name: `Weather Forecast Validation`;
- short name: `WFV`;
- theme color: `#f97316`;
- circular orange WFV icon;
- transparent icon corners/background where applicable.

`setup-pwa.ps1` regenerates the manifest, `+html.tsx`, PWA icon sizes, Apple touch icon, and browser favicons from `assets/images/icon.png`.

## PWA behavior

The app is installable as a PWA. There is intentionally no custom offline/service-worker cache layer at present.

After changing branding, run:

```powershell
.\setup-pwa.ps1
```

Then export and deploy normally.

## Frontend development

Typical Windows / PowerShell flow from the repository root:

```powershell
conda activate weather-app
npx expo start --web
```

Frontend API configuration is read from:

```text
EXPO_PUBLIC_WEATHER_API_URL
```

Do not hardcode private credentials into frontend source. This environment variable is an API base URL, not an OpenWeather key.

Use `.env.example` only as a placeholder template. Keep the real `.env` local and untracked.

## Frontend deployment

A Git push does not deploy the Expo site.

Always export first:

```powershell
npx expo export --platform web
```

Only if export succeeds:

```powershell
eas deploy --prod
```

Production URL:

```text
https://hvonkent-weather-app.expo.app
```

If `expo export` fails, do not trust a subsequent successful `eas deploy`; it may deploy stale output from an earlier build.

## API deployment

From repository root:

```powershell
cd .\weather-api
gcloud run deploy weather-api --source . --region=us-central1
cd ..
```

Prefer one-line PowerShell commands when practical. PowerShell uses the backtick for line continuation, not `\`.

## Collector deployment

The collector is a Cloud Run Job. From repository root, the existing job can be updated from source with:

```powershell
gcloud run jobs deploy weather-collector --source .\weather-job --region us-central1
```

A manual verification run can be triggered with:

```powershell
gcloud run jobs execute weather-collector --region us-central1 --wait
```

Do not replace Secret Manager configuration with a literal OpenWeather API key in source or command history.

After collector changes, verify that `processed/current.json` and all city validation files advance as expected. If the current compact-storage architecture is still intended, also verify that no raw timestamped GCS objects are being created.

## Legacy / recovery tooling

`weather-job/backfill_validation.py` was created for historical raw archive data. The raw cloud prefixes it was designed to read are no longer part of the current production bucket.

Treat that script as legacy/recovery tooling unless it is deliberately adapted to the local backup or to another explicit historical source. Do not make normal runtime code depend on it.

Do not delete or modify local backup data under `data/` as part of routine application refactoring.

## Git workflow

Typical flow:

```powershell
git status
git add -A
git status --short
git commit -m "Describe the change"
git push
```

Before committing, inspect `git status` and make sure no credentials, `.env` files, private keys, local weather dumps, generated build output, or temporary recovery files are being added.

In particular, `data/`, `.env`, `dist/`, `node_modules/`, and local deployment/recovery directories should remain untracked unless there is an intentional repository change.

For a public repository, remember that making the repository public exposes Git history as well as the current tree. Do not assume deleting a secret from the latest commit is sufficient if it was committed earlier.

## Agent working rules

When editing this project:

1. Inspect the current checked-out file before changing it. Do not assume an older chat-generated version is still current.
2. Preserve the compact forecast-history model and 1–5 day validation semantics.
3. Do not reintroduce raw timestamped GCS archives unless explicitly changing the storage architecture.
4. Preserve UTC storage/matching and city-local display conversion.
5. Preserve chart tick cadence: 3-hour ticks, 6-hour labels.
6. Preserve latest-data initial horizontal scroll.
7. Preserve metric/imperial conversion semantics and avoid extra backend calls for display changes.
8. Keep the current orange brand; forecast horizons remain blue.
9. Prefer generic metric components over metric-specific duplicated charts.
10. Treat `.env`, service-account files, API keys, private credentials, and local `data/` backups as non-committable.
11. Use `/weather/current` for homepage current data and `/weather/<city_slug>/validation` for validation pages; do not build new code on the legacy raw-weather route.
12. On Windows instructions, prefer paste-ready PowerShell commands.
13. Validate the Expo export before recommending production deployment.
