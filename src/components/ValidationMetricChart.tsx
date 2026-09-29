import {
  useMemo,
} from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";

import {
  TemperatureValidationPoint,
  WeatherValidationResponse,
} from "../services/weatherApi";

import {
  getValidationMetric,
  UnitSystem,
  ValidationMetricKey,
} from "./validationMetrics";


type Props = {
  metric: ValidationMetricKey;
  timeZone: string;
  validation: WeatherValidationResponse | null;
  loading: boolean;
  error: string | null;
  unitSystem: UnitSystem;
};


type ForecastStyle = {
  daysAhead: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string;
  radius: number;
};


const FORECAST_STYLES: ForecastStyle[] = [
  {
    daysAhead: 1,
    label: "1 day",
    color: "#2563eb",
    radius: 5,
  },
  {
    daysAhead: 2,
    label: "2 days",
    color: "#3b82f6",
    radius: 4.5,
  },
  {
    daysAhead: 3,
    label: "3 days",
    color: "#60a5fa",
    radius: 4,
  },
  {
    daysAhead: 4,
    label: "4 days",
    color: "#93c5fd",
    radius: 3.5,
  },
  {
    daysAhead: 5,
    label: "5 days",
    color: "#bfdbfe",
    radius: 3,
  },
];


const ACTUAL_COLOR = "#f97316";
const HOUR_WIDTH = 4;


function getLocalDateKey(
  timestamp: number,
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date(timestamp * 1000)
  );
}


function formatDayLabel(
  timestamp: number,
  timeZone: string,
  unitSystem: UnitSystem
) {
  return new Intl.DateTimeFormat(
    unitSystem === "imperial"
      ? "en-US"
      : "en-GB",
    {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date(timestamp * 1000)
  );
}


function formatTimeLabel(
  timestamp: number,
  timeZone: string,
  unitSystem: UnitSystem
) {
  const date =
    new Date(timestamp * 1000);

  if (unitSystem === "imperial") {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone,
        hour: "numeric",
        hour12: true,
      }
    )
      .format(date)
      .replace(" ", "")
      .toLowerCase();
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}


function getActualPath(
  data: TemperatureValidationPoint[],
  getActualValue: (
    point: TemperatureValidationPoint
  ) => number | null,
  getX: (timestamp: number) => number,
  getY: (value: number) => number
) {
  const commands: string[] = [];
  let drawing = false;

  data.forEach((point) => {
    const value = getActualValue(point);

    if (value === null) {
      drawing = false;
      return;
    }

    commands.push(
      `${drawing ? "L" : "M"} ${getX(point.timestamp)} ${getY(value)}`
    );

    drawing = true;
  });

  return commands.join(" ");
}


export default function ValidationMetricChart({
  metric: metricKey,
  timeZone,
  validation,
  loading,
  error,
  unitSystem,
}: Props) {
  const metric =
    getValidationMetric(
      metricKey,
      unitSystem
    );

  const { width: viewportWidth } =
    useWindowDimensions();

  const compact =
    viewportWidth < 720;

  const data = useMemo(
    () => (
      [...(validation?.points ?? [])]
        .sort(
          (a, b) =>
            a.timestamp - b.timestamp
        )
    ),
    [validation]
  );

  const values = useMemo(
    () => {
      const result: number[] = [];

      data.forEach((point) => {
        const actual =
          metric.getActualValue(point);

        if (actual !== null) {
          result.push(actual);
        }

        point.forecasts.forEach(
          (forecast) => {
            const forecastValue =
              metric.getForecastValue(
                forecast
              );

            if (forecastValue !== null) {
              result.push(forecastValue);
            }
          }
        );
      });

      return result;
    },
    [data, metric]
  );


  if (loading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.statusText}>
          Loading forecast validation…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.empty}>
        <Text style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  if (
    data.length === 0
    || values.length === 0
  ) {
    return (
      <View style={styles.empty}>
        <Text style={styles.statusText}>
          Validation data for this metric is not available yet.
        </Text>
      </View>
    );
  }


  const paddingLeft =
    compact ? 54 : 66;
  const paddingRight =
    compact ? 14 : 24;
  const paddingTop =
    compact ? 18 : 24;
  const paddingBottom =
    compact ? 58 : 76;

  const plotHeight =
    compact ? 390 : 540;
  const chartHeight =
    paddingTop +
    plotHeight +
    paddingBottom;

  const firstTimestamp =
    data[0].timestamp;

  const lastTimestamp =
    data[data.length - 1].timestamp;

  const totalHours = Math.max(
    (
      lastTimestamp -
      firstTimestamp
    ) / 3600,
    1
  );

  const plotWidth =
    totalHours * HOUR_WIDTH;

  const chartWidth =
    paddingLeft +
    plotWidth +
    paddingRight;

  const plotBottom =
    paddingTop +
    plotHeight;


  const rawMin =
    Math.min(...values);
  const rawMax =
    Math.max(...values);

  let minValue =
    metric.fixedMin
    ?? Math.floor(
      rawMin - metric.axisPadding
    );

  let maxValue =
    metric.fixedMax
    ?? Math.ceil(
      rawMax + metric.axisPadding
    );

  if (
    metric.lowerBound !== undefined
  ) {
    minValue = Math.max(
      minValue,
      metric.lowerBound
    );
  }

  if (maxValue <= minValue) {
    maxValue = minValue + 1;
  }

  const range =
    maxValue - minValue;


  const getX = (
    timestamp: number
  ) => (
    paddingLeft +
    (
      (
        timestamp -
        firstTimestamp
      ) / 3600
    ) * HOUR_WIDTH
  );

  const getY = (
    value: number
  ) => (
    paddingTop +
    (
      (
        maxValue - value
      ) / range
    ) * plotHeight
  );


  const actualPath = getActualPath(
    data,
    metric.getActualValue,
    getX,
    getY
  );

  const gridValues = [
    maxValue,
    maxValue - range * 0.25,
    maxValue - range * 0.5,
    maxValue - range * 0.75,
    minValue,
  ];


  const firstWholeHour =
    Math.ceil(
      firstTimestamp / 3600
    ) * 3600;

  const lastWholeHour =
    Math.floor(
      lastTimestamp / 3600
    ) * 3600;

  const hourlyTicks: number[] = [];

  for (
    let timestamp = firstWholeHour;
    timestamp <= lastWholeHour;
    timestamp += 3600
  ) {
    hourlyTicks.push(timestamp);
  }

  const xAxisLabelPoints =
    data.filter(
      (_, index) => index % 2 === 0
    );

  const dayStarts: number[] = [];

  for (
    let index = 1;
    index < hourlyTicks.length;
    index += 1
  ) {
    const previousDate =
      getLocalDateKey(
        hourlyTicks[index - 1],
        timeZone
      );

    const currentDate =
      getLocalDateKey(
        hourlyTicks[index],
        timeZone
      );

    if (currentDate !== previousDate) {
      dayStarts.push(
        hourlyTicks[index]
      );
    }
  }

  const dayBoundaries = [
    firstTimestamp,
    ...dayStarts.filter(
      (timestamp) =>
        timestamp > firstTimestamp
        && timestamp < lastTimestamp
    ),
    lastTimestamp,
  ].filter(
    (
      timestamp,
      index,
      all
    ) =>
      index === 0
      || timestamp !== all[index - 1]
  );

  const daySegments =
    dayBoundaries
      .slice(0, -1)
      .map(
        (
          startTimestamp,
          index
        ) => {
          const endTimestamp =
            dayBoundaries[index + 1];

          const middleTimestamp =
            startTimestamp +
            (
              endTimestamp -
              startTimestamp
            ) / 2;

          return {
            startTimestamp,
            endTimestamp,
            label: formatDayLabel(
              middleTimestamp,
              timeZone,
              unitSystem
            ),
          };
        }
      );


  return (
    <View style={styles.container}>
      <Text style={styles.explainer}>
        {metric.explainer}
      </Text>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.actualLegendLine}>
            <View style={styles.actualLegendDot} />
          </View>
          <Text style={styles.legendText}>
            {metric.actualLegendLabel}
          </Text>
        </View>

        {FORECAST_STYLES.map(
          (style) => (
            <View
              key={style.daysAhead}
              style={styles.legendItem}
            >
              <View
                style={[
                  styles.legendDot,
                  {
                    backgroundColor:
                      style.color,
                    width:
                      style.radius * 2,
                    height:
                      style.radius * 2,
                    borderRadius:
                      style.radius,
                  },
                ]}
              />
              <Text style={styles.legendText}>
                {style.label}
              </Text>
            </View>
          )
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
      >
        <Svg
          width={chartWidth}
          height={chartHeight}
        >
          {gridValues.map(
            (value, index) => {
              const y = getY(value);

              return (
                <Line
                  key={`grid-${index}`}
                  x1={paddingLeft}
                  y1={y}
                  x2={
                    chartWidth -
                    paddingRight
                  }
                  y2={y}
                  stroke="#e4e7ec"
                  strokeWidth={1}
                />
              );
            }
          )}

          {/* Tick at every 3-hour validation point. */}
          {data.map(
            (point) => (
              <Line
                key={`tick-${point.timestamp}`}
                x1={getX(point.timestamp)}
                y1={plotBottom}
                x2={getX(point.timestamp)}
                y2={plotBottom + 4}
                stroke="#cbd5e1"
                strokeWidth={0.8}
              />
            )
          )}

          {/* Label every other tick, so times appear every 6 hours. */}
          {xAxisLabelPoints.map(
            (point) => (
              <SvgText
                key={`time-${point.timestamp}`}
                x={getX(point.timestamp)}
                y={plotBottom + 18}
                textAnchor="middle"
                fontSize={compact ? 9 : 10}
                fill="#98a2b3"
              >
                {formatTimeLabel(
                  point.timestamp,
                  timeZone,
                  unitSystem
                )}
              </SvgText>
            )
          )}

          {dayStarts.map(
            (timestamp) => (
              <Line
                key={`day-${timestamp}`}
                x1={getX(timestamp)}
                y1={paddingTop}
                x2={getX(timestamp)}
                y2={plotBottom + 10}
                stroke="#98a2b3"
                strokeWidth={1.1}
                strokeDasharray={[5, 5]}
              />
            )
          )}

          {gridValues.map(
            (value, index) => {
              const y = getY(value);

              return (
                <SvgText
                  key={`y-label-${index}`}
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={compact ? 10 : 11}
                  fill="#667085"
                >
                  {metric.formatAxisValue(
                    value
                  )}
                </SvgText>
              );
            }
          )}

          <Path
            d={actualPath}
            fill="none"
            stroke={ACTUAL_COLOR}
            strokeOpacity={0.62}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {[...FORECAST_STYLES]
            .reverse()
            .map((style) =>
              data.map((point) => {
                const forecast =
                  point.forecasts.find(
                    (candidate) =>
                      candidate.days_ahead
                      === style.daysAhead
                  );

                if (!forecast) {
                  return null;
                }

                const forecastValue =
                  metric.getForecastValue(
                    forecast
                  );

                if (forecastValue === null) {
                  return null;
                }

                return (
                  <Circle
                    key={`forecast-${style.daysAhead}-${point.timestamp}`}
                    cx={getX(
                      point.timestamp
                    )}
                    cy={getY(
                      forecastValue
                    )}
                    r={style.radius}
                    fill={style.color}
                    stroke="#ffffff"
                    strokeWidth={1.1}
                  />
                );
              })
            )}

          {data.map((point) => {
            const actual =
              metric.getActualValue(point);

            if (actual === null) {
              return null;
            }

            return (
              <Circle
                key={`actual-${point.timestamp}`}
                cx={getX(
                  point.timestamp
                )}
                cy={getY(actual)}
                r={3.2}
                fill={ACTUAL_COLOR}
                fillOpacity={0.82}
                stroke="#ffffff"
                strokeWidth={1}
              />
            );
          })}

          {daySegments.map(
            (segment) => {
              const centerX =
                (
                  getX(
                    segment.startTimestamp
                  )
                  +
                  getX(
                    segment.endTimestamp
                  )
                ) / 2;

              return (
                <SvgText
                  key={`date-${segment.startTimestamp}`}
                  x={centerX}
                  y={chartHeight - 12}
                  textAnchor="middle"
                  fontSize={compact ? 10 : 12}
                  fontWeight="600"
                  fill="#475467"
                >
                  {segment.label}
                </SvgText>
              );
            }
          )}
        </Svg>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },

  explainer: {
    color: "#667085",
    fontSize: 13,
    marginBottom: 12,
  },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  legendText: {
    color: "#475467",
    fontSize: 12,
  },

  legendDot: {
    borderWidth: 1,
    borderColor: "#ffffff",
  },

  actualLegendLine: {
    width: 24,
    height: 10,
    borderTopWidth: 1.5,
    borderTopColor:
      "rgba(249, 115, 22, 0.62)",
    alignItems: "center",
    marginTop: 7,
  },

  actualLegendDot: {
    position: "absolute",
    top: -4.5,
    width: 6.5,
    height: 6.5,
    borderRadius: 4,
    backgroundColor:
      "rgba(249, 115, 22, 0.82)",
    borderWidth: 1,
    borderColor: "#ffffff",
  },

  empty: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  statusText: {
    color: "#667085",
    textAlign: "center",
  },

  errorText: {
    color: "#b42318",
    textAlign: "center",
  },
});
