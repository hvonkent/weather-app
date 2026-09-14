export type WeatherForecastPoint = {
  timestamp: number;
  temperature: number;
  wind_speed: number;
  pop: number;
  rain_3h: number;
};

export type CurrentWeather = {
  timestamp: number;
  temperature: number;
  feels_like: number;
  humidity: number;
  pressure: number;
  description: string;
  weather: string;
  icon: string;
  wind_speed: number;
  wind_direction: number;
  wind_gust?: number;
  cloud_cover: number;
  visibility: number;
  rain_1h: number;
};

export type WeatherResponse = {
  city_slug: string;
  city: string;
  country: string;
  timezone_offset: number;

  current_collected_at: string;
  forecast_collected_at: string;

  current: CurrentWeather;

  forecast: WeatherForecastPoint[];

  source: {
    current_object: string;
    forecast_object: string;
  };
};

export type ValidationForecastPoint = {
  days_ahead: 1 | 2 | 3 | 4 | 5;
  temperature: number | null;
  collected_at: string | null;
  lead_hours: number | null;
};

export type TemperatureValidationPoint = {
  timestamp: number;
  actual_temperature: number | null;
  actual_observed_at: number | null;
  actual_collected_at: string | null;
  forecasts: ValidationForecastPoint[];
};

export type WeatherValidationResponse = {
  city_slug: string;
  city: string;
  country: string;
  timezone_offset: number;
  days: number;
  interval_hours: number;
  points_expected: number;
  points: TemperatureValidationPoint[];
};

const API_URL =
  process.env.EXPO_PUBLIC_WEATHER_API_URL;

function getApiUrl() {
  if (!API_URL) {
    throw new Error(
      "EXPO_PUBLIC_WEATHER_API_URL is not configured."
    );
  }

  return API_URL;
}

export async function getWeather(
  citySlug: string
): Promise<WeatherResponse> {
  const response = await fetch(
    `${getApiUrl()}/weather/${citySlug}`
  );

  if (!response.ok) {
    throw new Error(
      `Weather API returned HTTP ${response.status}`
    );
  }

  return response.json();
}

export async function getWeatherValidation(
  citySlug: string,
  days = 7
): Promise<WeatherValidationResponse> {
  const response = await fetch(
    `${getApiUrl()}/weather/${citySlug}/validation?days=${days}`
  );

  if (!response.ok) {
    throw new Error(
      `Weather validation API returned HTTP ${response.status}`
    );
  }

  return response.json();
}
