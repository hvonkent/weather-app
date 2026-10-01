export type CurrentCityWeather = {
  city: string;
  country: string;
  timezone_offset: number;

  observed_at: number;
  collected_at: string;

  temperature: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;

  weather_main: string;
  weather_description: string;
  weather_icon: string;
};

export async function getCurrentWeather():
  Promise<CurrentWeatherResponse> {
  const response = await fetch(
    `${getApiUrl()}/weather/current`
  );

  if (!response.ok) {
    throw new Error(
      `Current weather API returned HTTP ${response.status}`
    );
  }

  return response.json();
}

export type CurrentWeatherResponse = {
  schema_version: number;
  updated_at: string;

  units: {
    temperature: string;
    humidity: string;
    wind_speed: string;
  };

  cities: Record<string, CurrentCityWeather>;
};

export type WeatherForecastPoint = {
  timestamp: number;
  temperature: number;
  feels_like: number;
  humidity: number;
  weather: string;
  description: string;
  wind_speed: number;
  cloud_cover: number;
  pop: number;
  rain_3h: number;
  snow_3h: number;
  precipitation_3h: number;
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
  snow_1h: number;
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
  feels_like: number | null;
  humidity: number | null;
  wind_speed: number | null;
  cloud_cover: number | null;
  weather_main: string | null;
  weather_description: string | null;
  probability_of_precipitation: number | null;
  rain_3h: number | null;
  snow_3h: number | null;
  precipitation_3h: number | null;
  collected_at: string | null;
  lead_hours: number | null;
};

export type TemperatureValidationPoint = {
  timestamp: number;

  actual_temperature: number | null;
  actual_feels_like: number | null;
  actual_humidity: number | null;
  actual_wind_speed: number | null;
  actual_cloud_cover: number | null;

  actual_weather_main: string | null;
  actual_weather_description: string | null;

  actual_rain_3h: number | null;
  actual_snow_3h: number | null;
  actual_precipitation_3h: number | null;
  actual_precipitation_occurred: boolean | null;

  actual_observed_at: number | null;
  forecasts: ValidationForecastPoint[];
};

export type WeatherValidationResponse = {
  city_slug: string;
  city: string;
  country: string;
  timezone_offset: number;
  updated_at: string | null;
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
