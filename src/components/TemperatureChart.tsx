import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Svg, {
  Circle,
  Line,
  Path,
  Text as SvgText,
} from "react-native-svg";

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


export default function TemperatureChart({
  data,
  timeZone,
}: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text>
          No forecast data available.
        </Text>
      </View>
    );
  }


  const chartWidth = 1400;
  const chartHeight = 300;

  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 55;


  const plotWidth =
    chartWidth -
    paddingLeft -
    paddingRight;

  const plotHeight =
    chartHeight -
    paddingTop -
    paddingBottom;


  const temperatures =
    data.map(
      (point) =>
        point.temperature
    );


  const minTemp =
    Math.floor(
      Math.min(
        ...temperatures
      )
    ) - 2;


  const maxTemp =
    Math.ceil(
      Math.max(
        ...temperatures
      )
    ) + 2;


  const range =
    maxTemp - minTemp;


  const getX = (
    index: number
  ) => {
    const denominator =
      Math.max(
        data.length - 1,
        1
      );

    return (
      paddingLeft +
      (
        index /
        denominator
      ) *
        plotWidth
    );
  };


  const getY = (
    temperature: number
  ) => {
    return (
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
  };


  const path =
    data
      .map(
        (
          point,
          index
        ) => {
          const x =
            getX(index);

          const y =
            getY(
              point.temperature
            );

          return `${
            index === 0
              ? "M"
              : "L"
          } ${x} ${y}`;
        }
      )
      .join(" ");


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


  return (
    <View style={styles.container}>
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
              const y =
                getY(
                  temperature
                );

              return (
                <Line
                  key={`grid-${index}`}
                  x1={
                    paddingLeft
                  }
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


          {gridValues.map(
            (
              temperature,
              index
            ) => {
              const y =
                getY(
                  temperature
                );

              return (
                <SvgText
                  key={`y-label-${index}`}
                  x={
                    paddingLeft -
                    10
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
            d={path}
            fill="none"
            stroke="#2563eb"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />


          {data.map(
            (
              point,
              index
            ) => (
              <Circle
                key={`point-${index}`}
                cx={
                  getX(index)
                }
                cy={
                  getY(
                    point.temperature
                  )
                }
                r={3.5}
                fill="#2563eb"
              />
            )
          )}


          {data.map(
            (
              point,
              index
            ) => {
              // Display a label
              // every 12 hours:
              // 4 × 3-hour intervals.
              if (
                index % 4 !== 0
              ) {
                return null;
              }

              const x =
                getX(index);

              const label =
                formatForecastTime(
                  point.timestamp,
                  timeZone
                );

              return (
                <SvgText
                  key={`x-label-${index}`}
                  x={x}
                  y={
                    chartHeight -
                    20
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
      backgroundColor:
        "#ffffff",
      borderRadius: 16,
      overflow: "hidden",
    },

    empty: {
      minHeight: 200,
      alignItems: "center",
      justifyContent:
        "center",
    },
  });