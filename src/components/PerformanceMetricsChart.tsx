import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  useLocalSearchParams,
} from "expo-router";

import Svg, {
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import {
  getWeatherValidation,
  TemperatureValidationPoint,
  WeatherValidationResponse,
} from "../services/weatherApi";


type Props = {
  timeZone: string;
};


type ForecastHorizon =
  1 | 2 | 3 | 4 | 5;


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


const DESKTOP_HOUR_WIDTH = 11;
const MOBILE_HOUR_WIDTH = 4;
const DESKTOP_CELL_HEIGHT = 38;
const MOBILE_CELL_HEIGHT = 32;
const DESKTOP_CELL_GAP = 3;
const MOBILE_CELL_GAP = 2;


const HEAT_BINS = [
  {
    max: 0.5,
    color: "#fff7ed",
    label: "0–0.5",
  },
  {
    max: 1,
    color: "#ffedd5",
    label: "0.5–1",
  },
  {
    max: 1.5,
    color: "#fed7aa",
    label: "1–1.5",
  },
  {
    max: 2,
    color: "#fdba74",
    label: "1.5–2",
  },
  {
    max: 3,
    color: "#fb923c",
    label: "2–3",
  },
  {
    max: 4,
    color: "#ea580c",
    label: "3–4",
  },
  {
    max: Number.POSITIVE_INFINITY,
    color: "#9a3412",
    label: "4+",
  },
];


function getRouteCity(
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}


function getHeatColor(
  error: number
) {
  return HEAT_BINS.find(
    (bin) => error <= bin.max
  )?.color ?? HEAT_BINS[
    HEAT_BINS.length - 1
  ].color;
}


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
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }
  ).format(
    new Date(timestamp * 1000)
  );
}


function formatDayLabel(
  timestamp: number,
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }
  ).format(
    new Date(timestamp * 1000)
  );
}


function formatTimeLabel(
  timestamp: number,
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      hour: "numeric",
      hour12: true,
    }
  )
    .format(
      new Date(timestamp * 1000)
    )
    .replace(" ", "")
    .toLowerCase();
}


function buildErrorPoints(
  data: TemperatureValidationPoint[]
): ErrorPoint[] {
  return data.map((point) => {
    const errors: ErrorPoint["errors"] = {};

    if (
      point.actual_temperature !== null
    ) {
      point.forecasts.forEach(
        (forecast) => {
          if (
            forecast.temperature !== null
          ) {
            errors[
              forecast.days_ahead
            ] = Math.abs(
              forecast.temperature -
              point.actual_temperature!
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


export default function PerformanceMetricsChart({
  timeZone,
}: Props) {
  const params = useLocalSearchParams<{
    city?: string | string[];
  }>();

  const citySlug = getRouteCity(
    params.city
  );

  const { width: viewportWidth } =
    useWindowDimensions();

  const compact =
    viewportWidth < 720;

  const hourWidth =
    compact
      ? MOBILE_HOUR_WIDTH
      : DESKTOP_HOUR_WIDTH;

  const cellHeight =
    compact
      ? MOBILE_CELL_HEIGHT
      : DESKTOP_CELL_HEIGHT;

  const cellGap =
    compact
      ? MOBILE_CELL_GAP
      : DESKTOP_CELL_GAP;

  const [validation, setValidation] =
    useState<WeatherValidationResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;

    if (!citySlug) {
      setLoading(false);
      setError(
        "Unable to determine the city for performance metrics."
      );
      return;
    }

    setLoading(true);
    setError(null);

    getWeatherValidation(
      citySlug,
      7
    )
      .then((result) => {
        if (!cancelled) {
          setValidation(result);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load performance metrics."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [citySlug]);


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
    () => buildErrorPoints(data),
    [data]
  );


  const maeByHorizon = useMemo(
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


  if (errorPoints.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.statusText}>
          No performance metrics available.
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

  const maeStartDate =
    formatRangeDate(
      firstTimestamp,
      timeZone
    );

  const maeEndDate =
    formatRangeDate(
      lastTimestamp,
      timeZone
    );

  const totalHours = Math.max(
    (
      lastTimestamp -
      firstTimestamp
    ) / 3600,
    1
  );

  const plotWidth =
    totalHours * hourWidth;

  const chartWidth =
    paddingLeft +
    plotWidth +
    paddingRight;

  const plotBottom =
    paddingTop +
    heatmapHeight;

  const cellWidth =
    hourWidth * 3;


  const getX = (
    timestamp: number
  ) => (
    paddingLeft +
    (
      (
        timestamp -
        firstTimestamp
      ) / 3600
    ) * hourWidth
  );


  const getRowY = (
    rowIndex: number
  ) => (
    paddingTop +
    rowIndex *
      (cellHeight + cellGap)
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

  // Validation points occur every 3 hours.
  // Label every other point, so the x-axis shows a time every 6 hours.
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
        timestamp > firstTimestamp &&
        timestamp < lastTimestamp
    ),
    lastTimestamp,
  ].filter(
    (
      timestamp,
      index,
      values
    ) =>
      index === 0 ||
      timestamp !== values[index - 1]
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
              timeZone
            ),
          };
        }
      );


  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>
        Absolute Error
      </Text>

      <Text style={styles.explainer}>
        |forecast − actual| at each 3-hour time point · °C
      </Text>

      <View style={styles.scaleLegend}>
        <Text style={styles.scaleLabel}>
          Absolute error (°C)
        </Text>

        <View style={styles.scaleBins}>
          {HEAT_BINS.map((bin) => (
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


          {/* One tick at every 3-hour validation point. */}
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

          {/* Label every other tick, so times appear every 6 hours. */}
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
                  timeZone
                )}
              </SvgText>
            )
          )}


          {daySegments.map(
            (segment) => {
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
          Mean Absolute Error (MAE)
        </Text>

        <Text style={styles.metricsRange}>
          Date range: {maeStartDate} – {maeEndDate}
        </Text>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator
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
                MAE
              </Text>
            </View>

            {HORIZONS.map(
              (horizon) => {
                const mae =
                  maeByHorizon[horizon];

                return (
                  <View
                    key={`mae-${horizon}`}
                    style={styles.tableCell}
                  >
                    <Text style={styles.tableValueText}>
                      {mae === undefined
                        ? "—"
                        : `${mae.toFixed(2)}°C`}
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
