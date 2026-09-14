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

import {
  formatForecastTime,
} from "../utils/dateTime";


export type TemperatureChartPoint = {
  timestamp: number;
  temperature: number;
};


type Props = {
  data: TemperatureChartPoint[];
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
  getX: (index: number) => number,
  getY: (temperature: number) => number
) {
  const commands: string[] = [];
  let drawing = false;

  data.forEach(
    (point, index) => {
      if (
        point.actual_temperature === null
      ) {
        drawing = false;
        return;
      }

      const command =
        drawing ? "L" : "M";

      commands.push(
        `${command} ${getX(index)} ${getY(point.actual_temperature)}`
      );

      drawing = true;
    }
  );

  return commands.join(" ");
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


  const data = validation?.points ?? [];

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


  const chartWidth = 1480;
  const chartHeight = 360;

  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 66;


  const plotWidth =
    chartWidth -
    paddingLeft -
    paddingRight;

  const plotHeight =
    chartHeight -
    paddingTop -
    paddingBottom;


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
    index: number
  ) => {
    const denominator = Math.max(
      data.length - 1,
      1
    );

    return (
      paddingLeft +
      (index / denominator) *
        plotWidth
    );
  };


  const getY = (
    temperature: number
  ) => {
    return (
      paddingTop +
      (
        (maxTemp - temperature)
        / range
      ) *
        plotHeight
    );
  };


  const actualPath = getActualPath(
    data,
    getX,
    getY
  );


  const gridValues = [
    maxTemp,
    maxTemp - range * 0.25,
    maxTemp - range * 0.5,
    maxTemp - range * 0.75,
    minTemp,
  ];


  const daySeparatorIndexes =
    data.reduce<number[]>(
      (indexes, point, index) => {
        if (index === 0) {
          return indexes;
        }

        const previousLabel =
          new Intl.DateTimeFormat(
            "en-US",
            {
              timeZone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }
          ).format(
            new Date(
              data[index - 1].timestamp * 1000
            )
          );

        const currentLabel =
          new Intl.DateTimeFormat(
            "en-US",
            {
              timeZone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            }
          ).format(
            new Date(
              point.timestamp * 1000
            )
          );

        if (
          currentLabel !== previousLabel
        ) {
          indexes.push(index);
        }

        return indexes;
      },
      []
    );


  return (
    <View style={styles.container}>
      <Text style={styles.explainer}>
        Past 7 days · actual temperature versus forecasts made 1–5 days earlier
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


          {daySeparatorIndexes.map(
            (index) => (
              <Line
                key={`day-${index}`}
                x1={getX(index)}
                y1={paddingTop}
                x2={getX(index)}
                y2={
                  chartHeight -
                  paddingBottom
                }
                stroke="#eef2f6"
                strokeWidth={1}
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
            stroke="#0f172a"
            strokeWidth={2.75}
            strokeLinejoin="round"
            strokeLinecap="round"
          />


          {[...FORECAST_STYLES]
            .reverse()
            .map((style) =>
              data.map(
                (point, index) => {
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
                      cx={getX(index)}
                      cy={getY(
                        forecast.temperature
                      )}
                      r={style.radius}
                      fill={style.color}
                      stroke="#ffffff"
                      strokeWidth={1.1}
                    />
                  );
                }
              )
            )}


          {data.map(
            (point, index) => {
              if (
                point.actual_temperature
                === null
              ) {
                return null;
              }

              return (
                <Circle
                  key={`actual-${point.timestamp}`}
                  cx={getX(index)}
                  cy={getY(
                    point.actual_temperature
                  )}
                  r={3.4}
                  fill="#0f172a"
                  stroke="#ffffff"
                  strokeWidth={1}
                />
              );
            }
          )}


          {data.map(
            (point, index) => {
              // Label every 12 hours:
              // 4 × 3-hour intervals.
              if (index % 4 !== 0) {
                return null;
              }

              const label =
                formatForecastTime(
                  point.timestamp,
                  timeZone
                );

              return (
                <SvgText
                  key={`x-label-${index}`}
                  x={getX(index)}
                  y={
                    chartHeight - 22
                  }
                  textAnchor="middle"
                  fontSize={12}
                  fill="#667085"
                >
                  {label}
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
      borderTopWidth: 2.5,
      borderTopColor: "#0f172a",
      alignItems: "center",
      marginTop: 7,
    },

    actualLegendDot: {
      position: "absolute",
      top: -5,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#0f172a",
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
