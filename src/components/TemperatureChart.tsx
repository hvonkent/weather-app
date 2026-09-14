import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useLocalSearchParams,
} from "expo-router";

import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";

import {
  getWeatherValidation,
  TemperatureValidationPoint,
  WeatherValidationResponse,
} from "../services/weatherApi";


export type TemperatureChartPoint = {
  timestamp: number;
  temperature: number;
};


type Props = {
  data?: TemperatureChartPoint[];
  timeZone: string;
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


const ACTUAL_COLOR = "#7c3aed";
const HOUR_WIDTH = 11;


function getRouteCity(
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}


function getActualPath(
  data: TemperatureValidationPoint[],
  getX: (timestamp: number) => number,
  getY: (temperature: number) => number
) {
  const commands: string[] = [];
  let drawing = false;

  data.forEach((point) => {
    if (
      point.actual_temperature === null
    ) {
      drawing = false;
      return;
    }

    const command =
      drawing ? "L" : "M";

    commands.push(
      `${command} ${getX(point.timestamp)} ${getY(point.actual_temperature)}`
    );

    drawing = true;
  });

  return commands.join(" ");
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


export default function TemperatureChart({
  timeZone,
}: Props) {
  const params = useLocalSearchParams<{
    city?: string | string[];
  }>();

  const citySlug = getRouteCity(
    params.city
  );

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
        "Unable to determine the city for forecast validation."
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
              : "Unable to load forecast validation data."
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


  const temperatures = useMemo(
    () => {
      const values: number[] = [];

      data.forEach((point) => {
        if (
          point.actual_temperature !== null
        ) {
          values.push(
            point.actual_temperature
          );
        }

        point.forecasts.forEach(
          (forecast) => {
            if (
              forecast.temperature !== null
            ) {
              values.push(
                forecast.temperature
              );
            }
          }
        );
      });

      return values;
    },
    [data]
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
    || temperatures.length === 0
  ) {
    return (
      <View style={styles.empty}>
        <Text style={styles.statusText}>
          No forecast validation data available.
        </Text>
      </View>
    );
  }


  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 76;

  // The old plot was about 270 px tall.
  // 540 px gives the requested 2x vertical magnification.
  const plotHeight = 540;
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

  // A true time scale:
  // every hour always occupies HOUR_WIDTH pixels.
  const plotWidth =
    totalHours * HOUR_WIDTH;

  const chartWidth =
    paddingLeft +
    plotWidth +
    paddingRight;

  const plotBottom =
    paddingTop +
    plotHeight;


  const minTemp =
    Math.floor(
      Math.min(...temperatures)
    ) - 2;

  const maxTemp =
    Math.ceil(
      Math.max(...temperatures)
    ) + 2;

  const range = Math.max(
    maxTemp - minTemp,
    1
  );


  const getX = (
    timestamp: number
  ) => (
    paddingLeft +
    (
      (
        timestamp -
        firstTimestamp
      ) / 3600
    ) *
      HOUR_WIDTH
  );


  const getY = (
    temperature: number
  ) => (
    paddingTop +
    (
      (
        maxTemp -
        temperature
      ) /
      range
    ) *
      plotHeight
  );


  const actualPath = getActualPath(
    data,
    getX,
    getY
  );


  const gridValues = [
    maxTemp,
    maxTemp -
      range * 0.25,
    maxTemp -
      range * 0.5,
    maxTemp -
      range * 0.75,
    minTemp,
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

    if (
      currentDate !== previousDate
    ) {
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
  ]
    .filter(
      (
        timestamp,
        index,
        values
      ) =>
        index === 0
        || timestamp !==
          values[index - 1]
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
      <Text style={styles.explainer}>
        Actual temperature versus forecasts made 1–5 days earlier
      </Text>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.actualLegendLine}>
            <View style={styles.actualLegendDot} />
          </View>
          <Text style={styles.legendText}>
            Actual
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
            (
              temperature,
              index
            ) => {
              const y = getY(
                temperature
              );

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


          {/* One small x-axis tick per hour. */}
          {hourlyTicks.map(
            (timestamp) => (
              <Line
                key={`hour-${timestamp}`}
                x1={getX(timestamp)}
                y1={plotBottom}
                x2={getX(timestamp)}
                y2={plotBottom + 5}
                stroke="#cbd5e1"
                strokeWidth={0.8}
              />
            )
          )}


          {/* Local midnight separators. */}
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
            (
              temperature,
              index
            ) => {
              const y = getY(
                temperature
              );

              return (
                <SvgText
                  key={`y-label-${index}`}
                  x={
                    paddingLeft - 10
                  }
                  y={y + 4}
                  textAnchor="end"
                  fontSize={12}
                  fill="#667085"
                >
                  {Math.round(
                    temperature
                  )}
                  °
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

                if (
                  forecast?.temperature
                  === null
                  || forecast?.temperature
                  === undefined
                ) {
                  return null;
                }

                return (
                  <Circle
                    key={`forecast-${style.daysAhead}-${point.timestamp}`}
                    cx={getX(
                      point.timestamp
                    )}
                    cy={getY(
                      forecast.temperature
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
            if (
              point.actual_temperature
              === null
            ) {
              return null;
            }

            return (
              <Circle
                key={`actual-${point.timestamp}`}
                cx={getX(
                  point.timestamp
                )}
                cy={getY(
                  point.actual_temperature
                )}
                r={3.2}
                fill={ACTUAL_COLOR}
                fillOpacity={0.82}
                stroke="#ffffff"
                strokeWidth={1}
              />
            );
          })}


          {/* One centered date label for each local calendar day. */}
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
                  y={
                    chartHeight - 22
                  }
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
    </View>
  );
}


const styles =
  StyleSheet.create({
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
        "rgba(124, 58, 237, 0.62)",
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
        "rgba(124, 58, 237, 0.82)",
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
