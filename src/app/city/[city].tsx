import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Link,
  useLocalSearchParams,
} from "expo-router";

import TemperatureChart from "../../components/TemperatureChart";
import PerformanceMetricsChart from "../../components/PerformanceMetricsChart";


const CITY_TIME_ZONES: Record<string, string> = {
  amsterdam: "Europe/Amsterdam",
  bremen: "Europe/Berlin",
  munich: "Europe/Berlin",
  rochester_mn: "America/Chicago",
  boston_ma: "America/New_York",
};


function getRouteCity(
  value: string | string[] | undefined
) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}


export default function CityPage() {
  const params = useLocalSearchParams<{
    city?: string | string[];
  }>();

  const citySlug =
    getRouteCity(params.city) ?? "";

  const timeZone =
    CITY_TIME_ZONES[citySlug] ?? "UTC";


  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
    >
      <Link href="/" asChild>
        <Pressable style={styles.backButton}>
          <Text style={styles.backButtonText}>
            ← All cities
          </Text>
        </Pressable>
      </Link>

      <View style={styles.section}>
        <Text style={styles.heading}>
          Temperature Forecast Validation
        </Text>

        <TemperatureChart
          timeZone={timeZone}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>
          Performance Metrics
        </Text>

        <PerformanceMetricsChart
          timeZone={timeZone}
        />
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  content: {
    width: "100%",
    maxWidth: 1280,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 56,
    gap: 42,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 12,
  },

  backButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },

  section: {
    width: "100%",
  },

  heading: {
    color: "#101828",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 18,
  },
});
