import {
  TemperatureValidationPoint,
  ValidationForecastPoint,
} from "../services/weatherApi";


export type ValidationMetricKey =
  | "temperature"
  | "feels_like"
  | "humidity"
  | "wind_speed"
  | "cloud_cover"
  | "probability_of_precipitation"
  | "precipitation_3h";

export type ForecastHorizon =
  1 | 2 | 3 | 4 | 5;

export type UnitSystem =
  "metric" | "imperial";

export type HeatBin = {
  max: number;
  color: string;
  label: string;
};

export type ValidationMetricConfig = {
  key: ValidationMetricKey;
  title: string;
  explainer: string;
  actualLegendLabel: string;
  unit: string;
  fixedMin?: number;
  fixedMax?: number;
  lowerBound?: number;
  axisPadding: number;
  axisDecimals: number;
  heatBins: HeatBin[];
  heatmapTitle: string;
  heatmapExplainer: string;
  heatmapLegendLabel: string;
  summaryTitle: string;
  summaryRowLabel: string;
  getActualValue: (
    point: TemperatureValidationPoint
  ) => number | null;
  getForecastValue: (
    forecast: ValidationForecastPoint
  ) => number | null;
  getErrorValue: (
    actual: number,
    forecast: number
  ) => number;
  formatAxisValue: (value: number) => string;
  formatSummaryValue: (value: number) => string;
};


const WARM_COLORS = [
  "#fff7ed",
  "#ffedd5",
  "#fed7aa",
  "#fdba74",
  "#fb923c",
  "#ea580c",
  "#9a3412",
];


const MPS_TO_MPH = 2.2369362920544;
const MM_PER_INCH = 25.4;


function usesImperialConversion(
  key: ValidationMetricKey
) {
  return (
    key === "temperature"
    || key === "feels_like"
    || key === "wind_speed"
    || key === "precipitation_3h"
  );
}


function convertValueToImperial(
  key: ValidationMetricKey,
  value: number
) {
  switch (key) {
    case "temperature":
    case "feels_like":
      return value * 9 / 5 + 32;

    case "wind_speed":
      return value * MPS_TO_MPH;

    case "precipitation_3h":
      return value / MM_PER_INCH;

    default:
      return value;
  }
}


function convertDifferenceToImperial(
  key: ValidationMetricKey,
  value: number
) {
  switch (key) {
    case "temperature":
    case "feels_like":
      return value * 9 / 5;

    case "wind_speed":
      return value * MPS_TO_MPH;

    case "precipitation_3h":
      return value / MM_PER_INCH;

    default:
      return value;
  }
}


function formatImperialBoundary(
  key: ValidationMetricKey,
  value: number
) {
  if (value === 0) {
    return "0";
  }

  if (
    key === "temperature"
    || key === "feels_like"
    || key === "wind_speed"
  ) {
    return value.toFixed(1).replace(/\.0$/, "");
  }

  if (key === "precipitation_3h") {
    if (value < 0.01) {
      return value.toFixed(3);
    }

    return value.toFixed(2).replace(/0$/, "");
  }

  return String(value);
}


function getImperialHeatBins(
  metric: ValidationMetricConfig
): HeatBin[] {
  let previous = 0;

  return metric.heatBins.map((bin) => {
    const max = Number.isFinite(bin.max)
      ? convertDifferenceToImperial(
          metric.key,
          bin.max
        )
      : Number.POSITIVE_INFINITY;

    const label = Number.isFinite(max)
      ? `${formatImperialBoundary(
          metric.key,
          previous
        )}–${formatImperialBoundary(
          metric.key,
          max
        )}`
      : `${formatImperialBoundary(
          metric.key,
          previous
        )}+`;

    if (Number.isFinite(max)) {
      previous = max;
    }

    return {
      ...bin,
      max,
      label,
    };
  });
}


function replaceMetricUnitText(
  text: string,
  key: ValidationMetricKey
) {
  switch (key) {
    case "temperature":
    case "feels_like":
      return text.replace(/°C/g, "°F");

    case "wind_speed":
      return text.replace(/m\/s/g, "mph");

    case "precipitation_3h":
      return text.replace(/mm/g, "in");

    default:
      return text;
  }
}


function buildBins(
  limits: number[],
  labels: string[]
): HeatBin[] {
  return [
    ...limits.map(
      (max, index) => ({
        max,
        color: WARM_COLORS[index],
        label: labels[index],
      })
    ),
    {
      max: Number.POSITIVE_INFINITY,
      color: WARM_COLORS[WARM_COLORS.length - 1],
      label: labels[labels.length - 1],
    },
  ];
}


const TEMPERATURE_BINS = buildBins(
  [0.5, 1, 1.5, 2, 3, 4],
  [
    "0–0.5",
    "0.5–1",
    "1–1.5",
    "1.5–2",
    "2–3",
    "3–4",
    "4+",
  ]
);

const HUMIDITY_BINS = buildBins(
  [2, 5, 10, 15, 20, 30],
  [
    "0–2",
    "2–5",
    "5–10",
    "10–15",
    "15–20",
    "20–30",
    "30+",
  ]
);

const WIND_BINS = buildBins(
  [0.5, 1, 1.5, 2, 3, 4],
  [
    "0–0.5",
    "0.5–1",
    "1–1.5",
    "1.5–2",
    "2–3",
    "3–4",
    "4+",
  ]
);

const CLOUD_BINS = buildBins(
  [5, 10, 20, 30, 40, 60],
  [
    "0–5",
    "5–10",
    "10–20",
    "20–30",
    "30–40",
    "40–60",
    "60+",
  ]
);

const PRECIPITATION_BINS = buildBins(
  [0.1, 0.5, 1, 2, 5, 10],
  [
    "0–0.1",
    "0.1–0.5",
    "0.5–1",
    "1–2",
    "2–5",
    "5–10",
    "10+",
  ]
);

const BRIER_BINS = buildBins(
  [0.02, 0.05, 0.1, 0.2, 0.4, 0.7],
  [
    "0–0.02",
    "0.02–0.05",
    "0.05–0.10",
    "0.10–0.20",
    "0.20–0.40",
    "0.40–0.70",
    "0.70+",
  ]
);


function formatDegrees(value: number) {
  return `${Math.round(value)}°`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatWind(value: number) {
  return `${value.toFixed(1)} m/s`;
}

function formatPrecipitation(value: number) {
  return `${value.toFixed(1)} mm`;
}


export const VALIDATION_METRICS: ValidationMetricConfig[] = [
  {
    key: "temperature",
    title: "Temperature Forecast Validation",
    explainer:
      "Actual temperature versus forecasts made 1–5 days earlier",
    actualLegendLabel: "Actual",
    unit: "°C",
    axisPadding: 2,
    axisDecimals: 0,
    heatBins: TEMPERATURE_BINS,
    heatmapTitle: "Absolute Error",
    heatmapExplainer:
      "|forecast − actual| at each 3-hour time point · °C",
    heatmapLegendLabel: "Absolute error (°C)",
    summaryTitle: "Mean Absolute Error (MAE)",
    summaryRowLabel: "MAE",
    getActualValue: (point) =>
      point.actual_temperature,
    getForecastValue: (forecast) =>
      forecast.temperature,
    getErrorValue: (actual, forecast) =>
      Math.abs(forecast - actual),
    formatAxisValue: formatDegrees,
    formatSummaryValue: (value) =>
      `${value.toFixed(2)}°C`,
  },
  {
    key: "feels_like",
    title: "Feels Like Temperature Forecast Validation",
    explainer:
      "Observed feels-like temperature versus forecasts made 1–5 days earlier",
    actualLegendLabel: "Actual",
    unit: "°C",
    axisPadding: 2,
    axisDecimals: 0,
    heatBins: TEMPERATURE_BINS,
    heatmapTitle: "Absolute Error",
    heatmapExplainer:
      "|forecast − actual| at each 3-hour time point · °C",
    heatmapLegendLabel: "Absolute error (°C)",
    summaryTitle: "Mean Absolute Error (MAE)",
    summaryRowLabel: "MAE",
    getActualValue: (point) =>
      point.actual_feels_like,
    getForecastValue: (forecast) =>
      forecast.feels_like,
    getErrorValue: (actual, forecast) =>
      Math.abs(forecast - actual),
    formatAxisValue: formatDegrees,
    formatSummaryValue: (value) =>
      `${value.toFixed(2)}°C`,
  },
  {
    key: "humidity",
    title: "Humidity Forecast Validation",
    explainer:
      "Observed relative humidity versus forecasts made 1–5 days earlier",
    actualLegendLabel: "Actual",
    unit: "%",
    fixedMin: 0,
    fixedMax: 100,
    axisPadding: 0,
    axisDecimals: 0,
    heatBins: HUMIDITY_BINS,
    heatmapTitle: "Absolute Error",
    heatmapExplainer:
      "|forecast − actual| at each 3-hour time point · percentage points",
    heatmapLegendLabel:
      "Absolute error (percentage points)",
    summaryTitle: "Mean Absolute Error (MAE)",
    summaryRowLabel: "MAE",
    getActualValue: (point) =>
      point.actual_humidity,
    getForecastValue: (forecast) =>
      forecast.humidity,
    getErrorValue: (actual, forecast) =>
      Math.abs(forecast - actual),
    formatAxisValue: formatPercent,
    formatSummaryValue: (value) =>
      `${value.toFixed(1)} pp`,
  },
  {
    key: "wind_speed",
    title: "Wind Speed Forecast Validation",
    explainer:
      "Observed wind speed versus forecasts made 1–5 days earlier",
    actualLegendLabel: "Actual",
    unit: "m/s",
    lowerBound: 0,
    axisPadding: 1,
    axisDecimals: 1,
    heatBins: WIND_BINS,
    heatmapTitle: "Absolute Error",
    heatmapExplainer:
      "|forecast − actual| at each 3-hour time point · m/s",
    heatmapLegendLabel: "Absolute error (m/s)",
    summaryTitle: "Mean Absolute Error (MAE)",
    summaryRowLabel: "MAE",
    getActualValue: (point) =>
      point.actual_wind_speed,
    getForecastValue: (forecast) =>
      forecast.wind_speed,
    getErrorValue: (actual, forecast) =>
      Math.abs(forecast - actual),
    formatAxisValue: formatWind,
    formatSummaryValue: (value) =>
      `${value.toFixed(2)} m/s`,
  },
  {
    key: "cloud_cover",
    title: "Cloud Cover Forecast Validation",
    explainer:
      "Observed cloud cover versus forecasts made 1–5 days earlier",
    actualLegendLabel: "Actual",
    unit: "%",
    fixedMin: 0,
    fixedMax: 100,
    axisPadding: 0,
    axisDecimals: 0,
    heatBins: CLOUD_BINS,
    heatmapTitle: "Absolute Error",
    heatmapExplainer:
      "|forecast − actual| at each 3-hour time point · percentage points",
    heatmapLegendLabel:
      "Absolute error (percentage points)",
    summaryTitle: "Mean Absolute Error (MAE)",
    summaryRowLabel: "MAE",
    getActualValue: (point) =>
      point.actual_cloud_cover,
    getForecastValue: (forecast) =>
      forecast.cloud_cover,
    getErrorValue: (actual, forecast) =>
      Math.abs(forecast - actual),
    formatAxisValue: formatPercent,
    formatSummaryValue: (value) =>
      `${value.toFixed(1)} pp`,
  },
  {
    key: "probability_of_precipitation",
    title: "Probability of Precipitation Forecast Validation",
    explainer:
      "Forecast precipitation probability versus whether precipitation actually occurred",
    actualLegendLabel: "Observed precipitation",
    unit: "%",
    fixedMin: 0,
    fixedMax: 100,
    axisPadding: 0,
    axisDecimals: 0,
    heatBins: BRIER_BINS,
    heatmapTitle: "Brier Error",
    heatmapExplainer:
      "(forecast probability − observed outcome)² at each 3-hour time point",
    heatmapLegendLabel: "Brier error",
    summaryTitle: "Brier Score",
    summaryRowLabel: "Brier score",
    getActualValue: (point) => {
      if (
        point.actual_precipitation_occurred === null
      ) {
        return null;
      }
      return point.actual_precipitation_occurred
        ? 100
        : 0;
    },
    getForecastValue: (forecast) => {
      if (
        forecast.probability_of_precipitation === null
      ) {
        return null;
      }
      return forecast.probability_of_precipitation * 100;
    },
    getErrorValue: (actual, forecast) => {
      const observed = actual / 100;
      const probability = forecast / 100;
      return (probability - observed) ** 2;
    },
    formatAxisValue: formatPercent,
    formatSummaryValue: (value) =>
      value.toFixed(3),
  },
  {
    key: "precipitation_3h",
    title: "Precipitation Amount Forecast Validation",
    explainer:
      "Observed rain + snow over each 3-hour period versus forecasts made 1–5 days earlier",
    actualLegendLabel: "Actual",
    unit: "mm",
    lowerBound: 0,
    axisPadding: 0.5,
    axisDecimals: 1,
    heatBins: PRECIPITATION_BINS,
    heatmapTitle: "Absolute Error",
    heatmapExplainer:
      "|forecast − actual| at each 3-hour time point · mm",
    heatmapLegendLabel: "Absolute error (mm)",
    summaryTitle: "Mean Absolute Error (MAE)",
    summaryRowLabel: "MAE",
    getActualValue: (point) =>
      point.actual_precipitation_3h,
    getForecastValue: (forecast) =>
      forecast.precipitation_3h,
    getErrorValue: (actual, forecast) =>
      Math.abs(forecast - actual),
    formatAxisValue: formatPrecipitation,
    formatSummaryValue: (value) =>
      `${value.toFixed(2)} mm`,
  },
];


export function getValidationMetric(
  key: ValidationMetricKey,
  unitSystem: UnitSystem = "metric"
): ValidationMetricConfig {
  const metric = VALIDATION_METRICS.find(
    (candidate) => candidate.key === key
  );

  if (!metric) {
    throw new Error(
      `Unknown validation metric: ${key}`
    );
  }

  if (
    unitSystem === "metric"
    || !usesImperialConversion(key)
  ) {
    return metric;
  }

  const getActualValue = (
    point: TemperatureValidationPoint
  ) => {
    const value = metric.getActualValue(point);

    return value === null
      ? null
      : convertValueToImperial(key, value);
  };

  const getForecastValue = (
    forecast: ValidationForecastPoint
  ) => {
    const value = metric.getForecastValue(
      forecast
    );

    return value === null
      ? null
      : convertValueToImperial(key, value);
  };

  const fixedMin =
    metric.fixedMin === undefined
      ? undefined
      : convertValueToImperial(
          key,
          metric.fixedMin
        );

  const fixedMax =
    metric.fixedMax === undefined
      ? undefined
      : convertValueToImperial(
          key,
          metric.fixedMax
        );

  const lowerBound =
    metric.lowerBound === undefined
      ? undefined
      : convertValueToImperial(
          key,
          metric.lowerBound
        );

  if (
    key === "temperature"
    || key === "feels_like"
  ) {
    return {
      ...metric,
      unit: "°F",
      fixedMin,
      fixedMax,
      lowerBound,
      axisPadding:
        convertDifferenceToImperial(
          key,
          metric.axisPadding
        ),
      heatBins: getImperialHeatBins(metric),
      heatmapExplainer:
        replaceMetricUnitText(
          metric.heatmapExplainer,
          key
        ),
      heatmapLegendLabel:
        replaceMetricUnitText(
          metric.heatmapLegendLabel,
          key
        ),
      getActualValue,
      getForecastValue,
      formatAxisValue: (value) =>
        `${Math.round(value)}°`,
      formatSummaryValue: (value) =>
        `${value.toFixed(2)}°F`,
    };
  }

  if (key === "wind_speed") {
    return {
      ...metric,
      unit: "mph",
      fixedMin,
      fixedMax,
      lowerBound,
      axisPadding:
        convertDifferenceToImperial(
          key,
          metric.axisPadding
        ),
      heatBins: getImperialHeatBins(metric),
      heatmapExplainer:
        replaceMetricUnitText(
          metric.heatmapExplainer,
          key
        ),
      heatmapLegendLabel:
        replaceMetricUnitText(
          metric.heatmapLegendLabel,
          key
        ),
      getActualValue,
      getForecastValue,
      formatAxisValue: (value) =>
        `${value.toFixed(1)} mph`,
      formatSummaryValue: (value) =>
        `${value.toFixed(2)} mph`,
    };
  }

  return {
    ...metric,
    unit: "in",
    fixedMin,
    fixedMax,
    lowerBound,
    axisPadding:
      convertDifferenceToImperial(
        key,
        metric.axisPadding
      ),
    axisDecimals: 2,
    heatBins: getImperialHeatBins(metric),
    heatmapExplainer:
      replaceMetricUnitText(
        metric.heatmapExplainer,
        key
      ),
    heatmapLegendLabel:
      replaceMetricUnitText(
        metric.heatmapLegendLabel,
        key
      ),
    getActualValue,
    getForecastValue,
    formatAxisValue: (value) =>
      `${
        value < 0.1
          ? value.toFixed(3)
          : value.toFixed(2)
      } in`,
    formatSummaryValue: (value) =>
      `${value.toFixed(3)} in`,
  };
}
