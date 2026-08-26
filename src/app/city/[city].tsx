import {
  useEffect,
  useState,
} from "react";

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import TemperatureChart from "../../components/TemperatureChart";

import {
  getCity,
  cities,
} from "../../constants/cities";

import {
  formatCollectedTime,
} from "../../utils/dateTime";

import {
  getWeather,
  type WeatherResponse,
} from "../../services/weatherApi";


export function generateStaticParams() {
  return cities.map(
    (city) => ({
      city: city.slug,
    })
  );
}

export default function CityScreen() {
  const params =
    useLocalSearchParams<{
      city:
        | string
        | string[];
    }>();


  const citySlug =
    Array.isArray(
      params.city
    )
      ? params.city[0]
      : params.city;


  const city =
    citySlug
      ? getCity(
          citySlug
        )
      : undefined;


  const [
    weather,
    setWeather,
  ] =
    useState<
      WeatherResponse | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);


  useEffect(() => {
    if (!citySlug) {
      return;
    }

    let cancelled =
      false;


    async function loadWeather() {
      try {
        setLoading(
          true
        );

        setError(
          null
        );

        const result =
          await getWeather(
            citySlug
          );

        if (!cancelled) {
          setWeather(
            result
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load weather data."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false
          );
        }
      }
    }


    loadWeather();


    return () => {
      cancelled = true;
    };
  }, [citySlug]);


  if (!city) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text>
          City not found.
        </Text>
      </View>
    );
  }


  if (loading) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text>
          Loading weather...
        </Text>
      </View>
    );
  }


  if (error) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text
          style={
            styles.error
          }
        >
          {error}
        </Text>

        <Pressable
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.back
            }
          >
            ← All cities
          </Text>
        </Pressable>
      </View>
    );
  }


  if (!weather) {
    return (
      <View
        style={
          styles.center
        }
      >
        <Text>
          No weather data
          available.
        </Text>
      </View>
    );
  }


  const chartData =
    weather.forecast.map(
      (point) => ({
        timestamp:
          point.timestamp,

        temperature:
          point.temperature,
      })
    );


  return (
    <ScrollView
      contentContainerStyle={
        styles.page
      }
    >
      <View
        style={
          styles.content
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.back
            }
          >
            ← All cities
          </Text>
        </Pressable>


        <View
          style={
            styles.header
          }
        >
          <Text
            style={
              styles.title
            }
          >
            {city.name}
          </Text>

          <Text
            style={
              styles.location
            }
          >
            {city.location}
          </Text>


          <View
            style={
              styles.currentTop
            }
          >
            <Text
              style={
                styles.currentTemperature
              }
            >
              {weather.current.temperature.toFixed(
                1
              )}
              °C
            </Text>

            <Text
              style={
                styles.currentDescription
              }
            >
              {
                weather
                  .current
                  .description
              }
            </Text>
          </View>


          <View
            style={
              styles.conditions
            }
          >
            <View
              style={
                styles.condition
              }
            >
              <Text
                style={
                  styles.conditionLabel
                }
              >
                Feels like
              </Text>

              <Text
                style={
                  styles.conditionValue
                }
              >
                {weather.current.feels_like.toFixed(
                  1
                )}
                °C
              </Text>
            </View>


            <View
              style={
                styles.condition
              }
            >
              <Text
                style={
                  styles.conditionLabel
                }
              >
                Humidity
              </Text>

              <Text
                style={
                  styles.conditionValue
                }
              >
                {
                  weather
                    .current
                    .humidity
                }
                %
              </Text>
            </View>


            <View
              style={
                styles.condition
              }
            >
              <Text
                style={
                  styles.conditionLabel
                }
              >
                Wind
              </Text>

              <Text
                style={
                  styles.conditionValue
                }
              >
                {
                  weather
                    .current
                    .wind_speed
                }{" "}
                m/s
              </Text>
            </View>


            <View
              style={
                styles.condition
              }
            >
              <Text
                style={
                  styles.conditionLabel
                }
              >
                Cloud cover
              </Text>

              <Text
                style={
                  styles.conditionValue
                }
              >
                {
                  weather
                    .current
                    .cloud_cover
                }
                %
              </Text>
            </View>
          </View>


          <Text
            style={
              styles.currentUpdated
            }
          >
            Current conditions
            collected{" "}
            {formatCollectedTime(
              weather.current_collected_at,
              city.timeZone
            )}{" "}
            local time
          </Text>
        </View>


        <View
          style={
            styles.chartCard
          }
        >
          <Text
            style={
              styles.chartTitle
            }
          >
            Temperature forecast
          </Text>


          <Text
            style={
              styles.chartSubtitle
            }
          >
            Next 5 days ·
            3-hour intervals ·{" "}
            {
              weather
                .forecast
                .length
            }{" "}
            forecast points
          </Text>


          <Text
            style={
              styles.updated
            }
          >
            Forecast collected{" "}
            {formatCollectedTime(
              weather.forecast_collected_at,
              city.timeZone
            )}{" "}
            local time
          </Text>


          <View
            style={
              styles.chart
            }
          >
            <TemperatureChart
              data={
                chartData
              }
              timeZone={
                city.timeZone
              }
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}


const styles =
  StyleSheet.create({
    page: {
      flexGrow: 1,
      backgroundColor:
        "#f4f7fb",
      padding: 24,
    },

    content: {
      width: "100%",
      maxWidth: 1100,
      alignSelf: "center",
    },

    back: {
      color: "#2563eb",
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 28,
    },

    header: {
      marginBottom: 28,
    },

    title: {
      fontSize: 38,
      fontWeight: "700",
      color: "#101828",
    },

    location: {
      marginTop: 5,
      fontSize: 17,
      color: "#667085",
    },

    currentTop: {
      marginTop: 22,
    },

    currentTemperature: {
      fontSize: 42,
      fontWeight: "700",
      color: "#101828",
    },

    currentDescription: {
      marginTop: 4,
      fontSize: 18,
      color: "#667085",
      textTransform:
        "capitalize",
    },

    conditions: {
      marginTop: 22,
      flexDirection:
        "row",
      flexWrap: "wrap",
      gap: 12,
    },

    condition: {
      minWidth: 140,
      flexGrow: 1,
      flexBasis: 180,
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor:
        "#e4e7ec",
      borderRadius: 14,
      padding: 16,
    },

    conditionLabel: {
      color: "#667085",
      fontSize: 13,
    },

    conditionValue: {
      marginTop: 5,
      color: "#101828",
      fontSize: 20,
      fontWeight: "600",
    },

    currentUpdated: {
      marginTop: 12,
      fontSize: 13,
      color: "#98a2b3",
    },

    chartCard: {
      backgroundColor:
        "#ffffff",
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor:
        "#e4e7ec",
    },

    chartTitle: {
      fontSize: 22,
      fontWeight: "600",
      color: "#101828",
    },

    chartSubtitle: {
      marginTop: 5,
      fontSize: 14,
      color: "#667085",
    },

    updated: {
      marginTop: 6,
      fontSize: 13,
      color: "#98a2b3",
    },

    chart: {
      marginTop: 24,
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 24,
    },

    error: {
      color: "#b42318",
      fontSize: 16,
      marginBottom: 20,
    },
  });