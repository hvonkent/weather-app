import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  Link,
} from "expo-router";

import {
  CurrentCityWeather,
  getCurrentWeather,
} from "../services/weatherApi";


type CityConfig = {
  slug: string;
  name: string;
  location: string;
  timeZone: string;
};


const CITIES: CityConfig[] = [
  {
    slug: "amsterdam",
    name: "Amsterdam",
    location: "Netherlands",
    timeZone: "Europe/Amsterdam",
  },
  {
    slug: "bremen",
    name: "Bremen",
    location: "Germany",
    timeZone: "Europe/Berlin",
  },
  {
    slug: "munich",
    name: "Munich",
    location: "Germany",
    timeZone: "Europe/Berlin",
  },
  {
    slug: "rochester_mn",
    name: "Rochester",
    location: "Minnesota, USA",
    timeZone: "America/Chicago",
  },
  {
    slug: "boston_ma",
    name: "Boston",
    location: "Massachusetts, USA",
    timeZone: "America/New_York",
  },
];


function formatTemperature(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return `${value.toFixed(1)}°C`;
}


function formatPercent(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return `${Math.round(value)}%`;
}


function formatWind(
  value: number | null | undefined
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  return `${value.toFixed(2)} m/s`;
}


function formatLocalTime(
  date: Date,
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  ).format(date);
}


function formatLocalDateTime(
  timestampMs: number,
  timeZone: string
) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  ).format(
    new Date(timestampMs)
  );
}


function titleCase(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  return value.replace(
    /\b\w/g,
    (character) =>
      character.toUpperCase()
  );
}


function CityCard({
  city,
  weather,
  now,
  compact,
}: {
  city: CityConfig;
  weather?: CurrentCityWeather;
  now: Date;
  compact: boolean;
}) {
  const collectedAt =
    weather?.collected_at
      ? formatLocalDateTime(
          Date.parse(
            weather.collected_at
          ),
          city.timeZone
        )
      : "—";

  return (
    <View
      style={[
        styles.card,
        compact
          ? styles.cardCompact
          : styles.cardWide,
      ]}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cityName}>
            {city.name}
          </Text>

          <Text style={styles.location}>
            {city.location}
          </Text>
        </View>

        <View style={styles.localTimeBlock}>
          <Text style={styles.metaLabel}>
            Local time
          </Text>

          <Text style={styles.localTime}>
            {formatLocalTime(
              now,
              city.timeZone
            )}
          </Text>
        </View>
      </View>


      <View style={styles.currentSection}>
        <Text style={styles.sectionEyebrow}>
          Current Weather
        </Text>

        {weather ? (
          <>
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>
                    Temperature
                  </Text>
                  <Text style={styles.statValue}>
                    {formatTemperature(
                      weather.temperature
                    )}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={styles.statLabel}>
                    Conditions
                  </Text>
                  <Text style={styles.statValue}>
                    {titleCase(
                      weather.weather_description
                    )}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={styles.statLabel}>
                    Wind
                  </Text>
                  <Text style={styles.statValue}>
                    {formatWind(
                      weather.wind_speed
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>
                    Feels like
                  </Text>
                  <Text style={styles.statValue}>
                    {formatTemperature(
                      weather.feels_like
                    )}
                  </Text>
                </View>

                <View style={styles.stat}>
                  <Text style={styles.statLabel}>
                    Humidity
                  </Text>
                  <Text style={styles.statValue}>
                    {formatPercent(
                      weather.humidity
                    )}
                  </Text>
                </View>

                <View style={styles.statSpacer} />
              </View>
            </View>

            <View style={styles.weatherMetadata}>
              <View style={styles.metadataRow}>
                <Text style={styles.metaLabel}>
                  Data collected
                </Text>
                <Text style={styles.metaValue}>
                  {collectedAt} local
                </Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.loadingBlock}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>
              Loading current weather…
            </Text>
          </View>
        )}
      </View>


      <View style={styles.validationContainer}>
        <View style={styles.validationBox}>
          <Link
            href={{
              pathname: "/city/[city]",
              params: {
                city: city.slug,
              },
            }}
            asChild
          >
            <Pressable style={styles.validationPressable}>
              <Text style={styles.validationTitle}>
                Forecast Validation
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}


export default function HomePage() {
  const [weatherByCity, setWeatherByCity] =
    useState<Record<string, CurrentCityWeather>>(
      {}
    );

  const [now, setNow] =
    useState(
      () => new Date()
    );

  const {
    width,
  } = useWindowDimensions();

  const compact =
    width < 720;


  useEffect(() => {
    let cancelled = false;

    getCurrentWeather()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setWeatherByCity(
          result.cities
        );
      })
      .catch((error) => {
        console.error(
          "Unable to load current weather",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    const interval = setInterval(
      () => {
        setNow(new Date());
      },
      30_000
    );

    return () => {
      clearInterval(interval);
    };
  }, []);


  const cards = useMemo(
    () => (
      CITIES.map((city) => (
        <CityCard
          key={city.slug}
          city={city}
          weather={
            weatherByCity[
              city.slug
            ]
          }
          now={now}
          compact={compact}
        />
      ))
    ),
    [
      weatherByCity,
      now,
      compact,
    ]
  );


  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.content
      }
    >
      <View style={styles.pageHeader}>
        <Image
          source={require(
            "../../assets/images/wfv-mark.png"
          )}
          style={[
            styles.brandMark,
            compact && styles.brandMarkCompact,
          ]}
          resizeMode="contain"
          accessibilityLabel="WFV logo"
        />

        <View style={styles.pageHeaderText}>
          <Text
            style={[
              styles.pageTitle,
              compact && styles.pageTitleCompact,
            ]}
          >
            Weather Forecast Validation
          </Text>

          <Text style={styles.pageSubtitle}>
            Observed weather vs. forecasts made 1–5 days earlier
          </Text>

          <View style={styles.headerAccent} />
        </View>
      </View>

      <View style={styles.cards}>
        {cards}
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },

  content: {
    width: "100%",
    maxWidth: 1220,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 48,
  },

  pageHeader: {
    marginBottom: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },

  brandMark: {
    width: 92,
    height: 68,
    flexShrink: 0,
  },

  brandMarkCompact: {
    width: 68,
    height: 50,
  },

  pageHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  pageTitle: {
    color: "#101828",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginBottom: 6,
  },

  pageTitleCompact: {
    fontSize: 30,
    letterSpacing: -0.4,
  },

  pageSubtitle: {
    color: "#667085",
    fontSize: 16,
    lineHeight: 23,
  },

  headerAccent: {
    width: 56,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#f97316",
    marginTop: 14,
  },

  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },

  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 18,
    overflow: "hidden",
  },

  cardWide: {
    flexGrow: 1,
    flexBasis: "31%",
    minWidth: 340,
  },

  cardCompact: {
    width: "100%",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
  },

  cityName: {
    color: "#101828",
    fontSize: 22,
    fontWeight: "700",
  },

  location: {
    color: "#667085",
    fontSize: 13,
    marginTop: 3,
  },

  localTimeBlock: {
    alignItems: "flex-end",
  },

  localTime: {
    color: "#101828",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },

  currentSection: {
    paddingHorizontal: 22,
    paddingBottom: 14,
  },

  sectionEyebrow: {
    color: "#667085",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  statsGrid: {
    gap: 9,
    marginBottom: 10,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  stat: {
    flex: 1,
    minWidth: 0,
  },

  statSpacer: {
    flex: 1,
    minWidth: 0,
  },

  statLabel: {
    color: "#98a2b3",
    fontSize: 10,
    lineHeight: 13,
    minHeight: 13,
    marginBottom: 2,
  },

  statValue: {
    color: "#101828",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 17,
    minHeight: 17,
  },

  weatherMetadata: {
    borderTopWidth: 1,
    borderTopColor: "#f0f2f5",
    paddingTop: 9,
  },

  metadataRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "flex-start",
    gap: 8,
  },

  metaLabel: {
    color: "#98a2b3",
    fontSize: 11,
  },

  metaValue: {
    color: "#667085",
    fontSize: 11,
    textAlign: "left",
  },

  loadingBlock: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  loadingText: {
    color: "#667085",
    fontSize: 13,
  },

  validationContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 18,
  },

  validationBox: {
    minWidth: 190,
    backgroundColor: "#fff7ed",
    borderWidth: 2,
    borderColor: "#f97316",
    borderRadius: 12,
    overflow: "hidden",
  },

  validationPressable: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  validationTitle: {
    color: "#c2410c",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

});
