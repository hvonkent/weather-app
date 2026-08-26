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
} from "expo-router";

import {
  cities,
} from "../constants/cities";

import {
  formatCollectedTime,
} from "../utils/dateTime";

import {
  getWeather,
  type WeatherResponse,
} from "../services/weatherApi";


type WeatherByCity = Record<
  string,
  WeatherResponse | undefined
>;


type ErrorsByCity = Record<
  string,
  boolean
>;


export default function HomeScreen() {
  const [
    weatherByCity,
    setWeatherByCity,
  ] =
    useState<WeatherByCity>(
      {}
    );


  const [
    errorsByCity,
    setErrorsByCity,
  ] =
    useState<ErrorsByCity>(
      {}
    );


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  useEffect(() => {
    let cancelled =
      false;


    async function loadCities() {
      setLoading(true);


      const results =
        await Promise.all(
          cities.map(
            async (
              city
            ) => {
              try {
                const weather =
                  await getWeather(
                    city.slug
                  );

                return {
                  slug:
                    city.slug,

                  weather,
                  error:
                    false,
                };
              } catch {
                return {
                  slug:
                    city.slug,

                  weather:
                    undefined,

                  error:
                    true,
                };
              }
            }
          )
        );


      if (cancelled) {
        return;
      }


      const newWeather:
        WeatherByCity =
          {};

      const newErrors:
        ErrorsByCity =
          {};


      results.forEach(
        (
          result
        ) => {
          if (
            result.weather
          ) {
            newWeather[
              result.slug
            ] =
              result.weather;
          }

          newErrors[
            result.slug
          ] =
            result.error;
        }
      );


      setWeatherByCity(
        newWeather
      );

      setErrorsByCity(
        newErrors
      );

      setLoading(false);
    }


    loadCities();


    return () => {
      cancelled = true;
    };
  }, []);


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
            Weather
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Current conditions
            and 5-day forecasts
          </Text>
        </View>


        <View
          style={
            styles.grid
          }
        >
          {cities.map(
            (
              city
            ) => {
              const weather =
                weatherByCity[
                  city.slug
                ];

              const failed =
                errorsByCity[
                  city.slug
                ];


              return (
                <Pressable
                  key={
                    city.slug
                  }
                  style={({ pressed }) => [
                    styles.card,

                    pressed &&
                      styles.cardPressed,
                  ]}
                  onPress={() =>
                    router.push(
                      {
                        pathname:
                          "/city/[city]",

                        params: {
                          city:
                            city.slug,
                        },
                      }
                    )
                  }
                >
                  <View
                    style={
                      styles.cardHeader
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.city
                        }
                      >
                        {
                          city.name
                        }
                      </Text>

                      <Text
                        style={
                          styles.location
                        }
                      >
                        {
                          city.location
                        }
                      </Text>
                    </View>


                    <Text
                      style={
                        styles.arrow
                      }
                    >
                      →
                    </Text>
                  </View>


                  {loading &&
                  !weather ? (
                    <Text
                      style={
                        styles.loading
                      }
                    >
                      Loading...
                    </Text>
                  ) : failed ? (
                    <Text
                      style={
                        styles.error
                      }
                    >
                      Weather
                      temporarily
                      unavailable
                    </Text>
                  ) : weather ? (
                    <>
                      <View
                        style={
                          styles.weatherRow
                        }
                      >
                        <Text
                          style={
                            styles.temperature
                          }
                        >
                          {weather.current.temperature.toFixed(
                            1
                          )}
                          °C
                        </Text>

                        <Text
                          style={
                            styles.description
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
                          styles.details
                        }
                      >
                        <View
                          style={
                            styles.detail
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Feels
                          </Text>

                          <Text
                            style={
                              styles.detailValue
                            }
                          >
                            {weather.current.feels_like.toFixed(
                              1
                            )}
                            °
                          </Text>
                        </View>


                        <View
                          style={
                            styles.detail
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Humidity
                          </Text>

                          <Text
                            style={
                              styles.detailValue
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
                            styles.detail
                          }
                        >
                          <Text
                            style={
                              styles.detailLabel
                            }
                          >
                            Wind
                          </Text>

                          <Text
                            style={
                              styles.detailValue
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
                      </View>


                      <Text
                        style={
                          styles.updated
                        }
                      >
                        Updated{" "}
                        {formatCollectedTime(
                          weather.current_collected_at,
                          city.timeZone
                        )}{" "}
                        local
                      </Text>
                    </>
                  ) : null}
                </Pressable>
              );
            }
          )}
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

    header: {
      marginBottom: 28,
    },

    title: {
      fontSize: 38,
      fontWeight: "700",
      color: "#101828",
    },

    subtitle: {
      marginTop: 5,
      fontSize: 17,
      color: "#667085",
    },

    grid: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      gap: 16,
    },

    card: {
      flexGrow: 1,
      flexBasis: 320,
      minWidth: 280,

      backgroundColor:
        "#ffffff",

      padding: 22,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        "#e4e7ec",
    },

    cardPressed: {
      opacity: 0.75,
    },

    cardHeader: {
      flexDirection:
        "row",

      alignItems:
        "flex-start",

      justifyContent:
        "space-between",
    },

    city: {
      fontSize: 22,
      fontWeight: "600",
      color: "#101828",
    },

    location: {
      marginTop: 4,
      fontSize: 14,
      color: "#667085",
    },

    arrow: {
      fontSize: 24,
      color: "#2563eb",
    },

    weatherRow: {
      marginTop: 22,
    },

    temperature: {
      fontSize: 34,
      fontWeight: "700",
      color: "#101828",
    },

    description: {
      marginTop: 3,
      fontSize: 16,
      color: "#667085",
      textTransform:
        "capitalize",
    },

    details: {
      marginTop: 20,
      flexDirection:
        "row",
      gap: 20,
    },

    detail: {
      flexGrow: 1,
    },

    detailLabel: {
      fontSize: 12,
      color: "#98a2b3",
    },

    detailValue: {
      marginTop: 3,
      fontSize: 15,
      fontWeight: "600",
      color: "#344054",
    },

    updated: {
      marginTop: 18,
      fontSize: 12,
      color: "#98a2b3",
    },

    loading: {
      marginTop: 24,
      color: "#667085",
    },

    error: {
      marginTop: 24,
      color: "#b42318",
    },
  });