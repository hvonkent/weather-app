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

const API_URL =
  process.env.EXPO_PUBLIC_WEATHER_API_URL;

export async function getWeather(
  citySlug: string
): Promise<WeatherResponse> {
  if (!API_URL) {
    throw new Error(
      "EXPO_PUBLIC_WEATHER_API_URL is not configured."
    );
  }

  const response = await fetch(
    `${API_URL}/weather/${citySlug}`
  );

  if (!response.ok) {
    throw new Error(
      `Weather API returned HTTP ${response.status}`
    );
  }

  return response.json();
}