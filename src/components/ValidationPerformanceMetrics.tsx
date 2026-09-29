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
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import {
  TemperatureValidationPoint,
  WeatherValidationResponse,
} from "../services/weatherApi";

import {
  ForecastHorizon,
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


type ErrorPoint = {
  timestamp: number;
  errors: Partial<
    Record<ForecastHorizon, number>
  >;
};


const HORIZONS: ForecastHorizon[] = [
  1,
  2,
  3,
  4,
  5,
];

const HOUR_WIDTH = 4;
const VALIDATION_INTERVAL_HOURS = 3;
const POINTS_PER_DAY = 8;
const REFERENCE_HISTORY_DAYS = 14;
const FIXED_PLOT_WIDTH =
  (REFERENCE_HISTORY_DAYS * POINTS_PER_DAY - 1)
  * VALIDATION_INTERVAL_HOURS
  * HOUR_WIDTH;
const DESKTOP_CELL_HEIGHT = 38;
const MOBILE_CELL_HEIGHT = 32;
const DESKTOP_CELL_GAP = 3;
const MOBILE_CELL_GAP = 2;


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


function formatRangeDate(
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


function buildErrorPoints(
  data: TemperatureValidationPoint[],
  metricKey: ValidationMetricKey,
  unitSystem: UnitSystem
): ErrorPoint[] {
  const metric =
    getValidationMetric(
      metricKey,
      unitSystem
    );

  return data.map((point) => {
    const errors: ErrorPoint["errors"] = {};

    const actual =
      metric.getActualValue(point);

    if (actual !== null) {
      point.forecasts.forEach(
        (forecast) => {
          const forecastValue =
            metric.getForecastValue(
              forecast
            );

          if (forecastValue !== null) {
            errors[
              forecast.days_ahead
            ] = metric.getErrorValue(
              actual,
              forecastValue
            );
          }
        }
      );
    }

    return {
      timestamp: point.timestamp,
      errors,
    };
  });
}


export default function ValidationPerformanceMetrics({
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

  const cellHeight =
    compact
      ? MOBILE_CELL_HEIGHT
      : DESKTOP_CELL_HEIGHT;

  const cellGap =
    compact
      ? MOBILE_CELL_GAP
      : DESKTOP_CELL_GAP;

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

  const errorPoints = useMemo(
    () => buildErrorPoints(
      data,
      metricKey,
      unitSystem
    ),
    [
      data,
      metricKey,
      unitSystem,
    ]
  );

  const hasAnyError = useMemo(
    () => errorPoints.some(
      (point) =>
        Object.keys(point.errors).length > 0
    ),
    [errorPoints]
  );

  const summaryByHorizon = useMemo(
    () => {
      const result: Partial<
        Record<ForecastHorizon, number>
      > = {};

      HORIZONS.forEach((horizon) => {
        const values = errorPoints
          .map(
            (point) =>
              point.errors[horizon]
          )
          .filter(
            (value): value is number =>
              value !== undefined
          );

        if (values.length > 0) {
          result[horizon] =
            values.reduce(
              (sum, value) =>
                sum + value,
              0
            ) / values.length;
        }
      });

      return result;
    },
    [errorPoints]
  );


  if (loading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.statusText}>
          Loading performance metrics…
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
    errorPoints.length === 0
    || !hasAnyError
  ) {
    return (
      <View style={styles.empty}>
        <Text style={styles.statusText}>
          Performance data for this metric is not available yet.
        </Text>
      </View>
    );
  }


  const paddingLeft =
    compact ? 62 : 76;
  const paddingRight =
    compact ? 14 : 24;
  const paddingTop =
    compact ? 14 : 18;
  const paddingBottom =
    compact ? 54 : 68;

  const heatmapHeight =
    HORIZONS.length *
    (cellHeight + cellGap) -
    cellGap;

  const chartHeight =
    paddingTop +
    heatmapHeight +
    paddingBottom;

  const firstTimestamp =
    errorPoints[0].timestamp;

  const lastTimestamp =
    errorPoints[
      errorPoints.length - 1
    ].timestamp;

  const rangeStartDate =
    formatRangeDate(
      firstTimestamp,
      timeZone,
      unitSystem
    );

  const rangeEndDate =
    formatRangeDate(
      lastTimestamp,
      timeZone,
      unitSystem
    );

  const timestampSpan = Math.max(
    lastTimestamp - firstTimestamp,
    1
  );

  // Keep 3, 7, and 14 day views the same physical width.
  const plotWidth = FIXED_PLOT_WIDTH;

  const chartWidth =
    paddingLeft +
    plotWidth +
    paddingRight;

  const plotBottom =
    paddingTop +
    heatmapHeight;

  const pointSpacing =
    plotWidth / Math.max(
      errorPoints.length - 1,
      1
    );

  const cellWidth = Math.max(
    pointSpacing,
    1
  );


  const getX = (
    timestamp: number
  ) => (
    paddingLeft +
    (
      (
        timestamp - firstTimestamp
      ) / timestampSpan
    ) * plotWidth
  );

  const getRowY = (
    rowIndex: number
  ) => (
    paddingTop +
    rowIndex *
      (cellHeight + cellGap)
  );

  const getHeatColor = (
    value: number
  ) => (
    metric.heatBins.find(
      (bin) => value <= bin.max
    )?.color
    ?? metric.heatBins[
      metric.heatBins.length - 1
    ].color
  );


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
    errorPoints.filter(
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
      <Text style={styles.chartTitle}>
        {metric.heatmapTitle}
      </Text>

      <Text style={styles.explainer}>
        {metric.heatmapExplainer}
      </Text>

      <View style={styles.scaleLegend}>
        <Text style={styles.scaleLabel}>
          {metric.heatmapLegendLabel}
        </Text>

        <View style={styles.scaleBins}>
          {metric.heatBins.map((bin) => (
            <View
              key={bin.label}
              style={styles.scaleItem}
            >
              <View
                style={[
                  styles.scaleBox,
                  {
                    backgroundColor:
                      bin.color,
                  },
                ]}
              />
              <Text style={styles.scaleText}>
                {bin.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
      >
        <Svg
          width={chartWidth}
          height={chartHeight}
        >
          {HORIZONS.map(
            (
              horizon,
              rowIndex
            ) => (
              <SvgText
                key={`row-${horizon}`}
                x={paddingLeft - 12}
                y={
                  getRowY(rowIndex) +
                  cellHeight / 2 +
                  4
                }
                textAnchor="end"
                fontSize={12}
                fontWeight="600"
                fill="#475467"
              >
                {horizon} day
              </SvgText>
            )
          )}

          {HORIZONS.map(
            (
              horizon,
              rowIndex
            ) =>
              errorPoints.map(
                (point) => {
                  const value =
                    point.errors[horizon];

                  if (value === undefined) {
                    return null;
                  }

                  return (
                    <Rect
                      key={`cell-${horizon}-${point.timestamp}`}
                      x={
                        getX(
                          point.timestamp
                        ) -
                        cellWidth / 2 +
                        1
                      }
                      y={getRowY(
                        rowIndex
                      )}
                      width={
                        cellWidth - 2
                      }
                      height={cellHeight}
                      rx={3}
                      fill={getHeatColor(
                        value
                      )}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  );
                }
              )
          )}

          {dayStarts.map(
            (timestamp) => (
              <Line
                key={`day-${timestamp}`}
                x1={getX(timestamp)}
                y1={paddingTop - 5}
                x2={getX(timestamp)}
                y2={plotBottom + 10}
                stroke="#98a2b3"
                strokeWidth={1.1}
                strokeDasharray={[5, 5]}
              />
            )
          )}

          {errorPoints.map(
            (point) => (
              <Line
                key={`tick-${point.timestamp}`}
                x1={getX(point.timestamp)}
                y1={plotBottom + 3}
                x2={getX(point.timestamp)}
                y2={plotBottom + 7}
                stroke="#cbd5e1"
                strokeWidth={0.8}
              />
            )
          )}

          {xAxisLabelPoints.map(
            (point) => (
              <SvgText
                key={`time-${point.timestamp}`}
                x={getX(point.timestamp)}
                y={plotBottom + 19}
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

          {daySegments
            .slice(1)
            .map((segment) => {
              const centerX =
                (
                  getX(
                    segment.startTimestamp
                  ) +
                  getX(
                    segment.endTimestamp
                  )
                ) / 2;

              return (
                <SvgText
                  key={`date-${segment.startTimestamp}`}
                  x={centerX}
                  y={chartHeight - 10}
                  textAnchor="middle"
                  fontSize={12}
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

      <View style={styles.metricsBlock}>
        <Text style={styles.metricsTitle}>
          {metric.summaryTitle}
        </Text>

        <Text style={styles.metricsRange}>
          Date range: {rangeStartDate} – {rangeEndDate}
        </Text>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={compact}
          contentContainerStyle={styles.tableScrollContent}
        >
          <View
            style={[
              styles.table,
              compact
                ? styles.tableCompact
                : styles.tableWide,
            ]}
          >
            <View style={styles.tableRow}>
              <View
                style={[
                  styles.tableCell,
                  styles.tableLabelCell,
                ]}
              >
                <Text style={styles.tableHeaderText}>
                  Forecast horizon
                </Text>
              </View>

              {HORIZONS.map(
                (horizon) => (
                  <View
                    key={`header-${horizon}`}
                    style={styles.tableCell}
                  >
                    <Text style={styles.tableHeaderText}>
                      {horizon} day
                    </Text>
                  </View>
                )
              )}
            </View>

            <View style={styles.tableRow}>
              <View
                style={[
                  styles.tableCell,
                  styles.tableLabelCell,
                ]}
              >
                <Text style={styles.tableLabelText}>
                  {metric.summaryRowLabel}
                </Text>
              </View>

              {HORIZONS.map(
                (horizon) => {
                  const summary =
                    summaryByHorizon[
                      horizon
                    ];

                  return (
                    <View
                      key={`summary-${horizon}`}
                      style={styles.tableCell}
                    >
                      <Text style={styles.tableValueText}>
                        {summary === undefined
                          ? "—"
                          : metric.formatSummaryValue(
                            summary
                          )}
                      </Text>
                    </View>
                  );
                }
              )}
            </View>
          </View>
        </ScrollView>
      </View>
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

  chartTitle: {
    color: "#101828",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },

  explainer: {
    color: "#667085",
    fontSize: 13,
    marginBottom: 14,
  },

  scaleLegend: {
    marginBottom: 14,
  },

  scaleLabel: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 7,
  },

  scaleBins: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },

  scaleItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  scaleBox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#e4e7ec",
  },

  scaleText: {
    color: "#667085",
    fontSize: 11,
  },

  metricsBlock: {
    marginTop: 22,
  },

  metricsTitle: {
    color: "#101828",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },

  metricsRange: {
    color: "#667085",
    fontSize: 12,
    marginBottom: 10,
  },

  tableScrollContent: {
    paddingBottom: 4,
  },

  table: {
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 10,
    overflow: "hidden",
  },

  tableCompact: {
    width: 570,
  },

  tableWide: {
    width: "100%",
  },

  tableRow: {
    flexDirection: "row",
  },

  tableCell: {
    flex: 1,
    minWidth: 88,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#e4e7ec",
    borderTopWidth: 1,
    borderTopColor: "#e4e7ec",
  },

  tableLabelCell: {
    minWidth: 130,
    alignItems: "flex-start",
  },

  tableHeaderText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  tableLabelText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
  },

  tableValueText: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "700",
  },

  empty: {
    minHeight: 220,
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
