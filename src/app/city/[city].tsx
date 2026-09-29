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
  Link,
  useLocalSearchParams,
} from "expo-router";

import ValidationMetricChart from "../../components/ValidationMetricChart";
import ValidationPerformanceMetrics from "../../components/ValidationPerformanceMetrics";

import {
  UnitSystem,
  VALIDATION_METRICS,
  ValidationMetricKey,
} from "../../components/validationMetrics";

import {
  getWeatherValidation,
  WeatherValidationResponse,
} from "../../services/weatherApi";


const CITY_TIME_ZONES: Record<string, string> = {
  amsterdam: "Europe/Amsterdam",
  bremen: "Europe/Berlin",
  munich: "Europe/Berlin",
  rochester_mn: "America/Chicago",
  boston_ma: "America/New_York",
};


type ValidationDays = 3 | 7 | 14;


const VALIDATION_DAY_OPTIONS: ValidationDays[] = [
  3,
  7,
  14,
];


const UNIT_SYSTEM_OPTIONS: {
  value: UnitSystem;
  label: string;
}[] = [
  {
    value: "metric",
    label: "Metric",
  },
  {
    value: "imperial",
    label: "Imperial",
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


function getSectionTitle(
  title: string
) {
  return title.replace(
    " Forecast Validation",
    ""
  );
}


export default function CityPage() {
  const params = useLocalSearchParams<{
    city?: string | string[];
  }>();

  const citySlug =
    getRouteCity(params.city) ?? "";

  const timeZone =
    CITY_TIME_ZONES[citySlug] ?? "UTC";

  const [days, setDays] =
    useState<ValidationDays>(3);

  const [unitSystem, setUnitSystem] =
    useState<UnitSystem>("metric");

  const [expandedMetrics, setExpandedMetrics] =
    useState<ValidationMetricKey[]>([
      "temperature",
    ]);

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
      setValidation(null);
      setLoading(false);
      setError(
        "Unable to determine the city for forecast validation."
      );
      return;
    }

    setValidation(null);
    setLoading(true);
    setError(null);

    getWeatherValidation(
      citySlug,
      days
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
  }, [citySlug, days]);


  const toggleMetric = (
    metricKey: ValidationMetricKey
  ) => {
    setExpandedMetrics((current) => (
      current.includes(metricKey)
        ? current.filter(
            (key) => key !== metricKey
          )
        : [
            ...current,
            metricKey,
          ]
    ));
  };


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

      <View style={styles.pageHeader}>
        <Text style={styles.pageHeading}>
          Forecast Validation
        </Text>

        <Text style={styles.pageSubtitle}>
          Compare observed conditions with forecasts made 1–5 days earlier.
        </Text>

        <View style={styles.settingsRow}>
          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>
              History
            </Text>

            <View style={styles.settingButtons}>
              {VALIDATION_DAY_OPTIONS.map(
                (option) => {
                  const selected =
                    days === option;

                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected,
                      }}
                      onPress={() =>
                        setDays(option)
                      }
                      style={[
                        styles.settingButton,
                        selected
                          && styles.settingButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.settingButtonText,
                          selected
                            && styles.settingButtonTextSelected,
                        ]}
                      >
                        {option} days
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          </View>

          <View style={styles.settingGroup}>
            <Text style={styles.settingLabel}>
              Display
            </Text>

            <View style={styles.settingButtons}>
              {UNIT_SYSTEM_OPTIONS.map(
                (option) => {
                  const selected =
                    unitSystem === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected,
                      }}
                      onPress={() =>
                        setUnitSystem(option.value)
                      }
                      style={[
                        styles.settingButton,
                        selected
                          && styles.settingButtonSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.settingButtonText,
                          selected
                            && styles.settingButtonTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                }
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.metricsList}>
        {VALIDATION_METRICS.map(
          (metric) => {
            const expanded =
              expandedMetrics.includes(
                metric.key
              );

            return (
              <View
                key={metric.key}
                style={styles.metricSection}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    expanded,
                  }}
                  onPress={() =>
                    toggleMetric(metric.key)
                  }
                  style={styles.metricHeader}
                >
                  <Text style={styles.metricHeading}>
                    {getSectionTitle(
                      metric.title
                    )}
                  </Text>

                  <Text style={styles.chevron}>
                    {expanded ? "−" : "+"}
                  </Text>
                </Pressable>

                {expanded && (
                  <View style={styles.metricContent}>
                    <Text style={styles.chartHeading}>
                      {metric.title}
                    </Text>

                    <ValidationMetricChart
                      metric={metric.key}
                      timeZone={timeZone}
                      validation={validation}
                      loading={loading}
                      error={error}
                      unitSystem={unitSystem}
                    />

                    <Text style={styles.performanceHeading}>
                      Performance Metrics
                    </Text>

                    <ValidationPerformanceMetrics
                      metric={metric.key}
                      timeZone={timeZone}
                      validation={validation}
                      loading={loading}
                      error={error}
                      unitSystem={unitSystem}
                    />
                  </View>
                )}
              </View>
            );
          }
        )}
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
    paddingBottom: 72,
  },

  backButton: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 12,
    marginBottom: 24,
  },

  backButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "600",
  },

  pageHeader: {
    marginBottom: 28,
  },

  pageHeading: {
    color: "#101828",
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 6,
  },

  pageSubtitle: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },

  settingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 22,
  },

  settingGroup: {
    gap: 8,
  },

  settingLabel: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "600",
  },

  settingButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  settingButton: {
    minWidth: 72,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#d0d5dd",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },

  settingButtonSelected: {
    borderColor: "#7c3aed",
    backgroundColor: "#7c3aed",
  },

  settingButtonText: {
    color: "#475467",
    fontSize: 13,
    fontWeight: "600",
  },

  settingButtonTextSelected: {
    color: "#ffffff",
  },

  metricsList: {
    width: "100%",
    gap: 14,
  },

  metricSection: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#e4e7ec",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },

  metricHeader: {
    minHeight: 66,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  metricHeading: {
    flex: 1,
    color: "#101828",
    fontSize: 20,
    fontWeight: "700",
  },

  chevron: {
    color: "#667085",
    fontSize: 24,
    fontWeight: "400",
    lineHeight: 26,
  },

  metricContent: {
    borderTopWidth: 1,
    borderTopColor: "#eaecf0",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 28,
  },

  chartHeading: {
    color: "#101828",
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 18,
  },

  performanceHeading: {
    color: "#101828",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 42,
    marginBottom: 18,
  },
});
