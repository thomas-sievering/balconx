import type { ConfigData, ForecastData, HourForecast } from './types.js';

interface OpenMeteoResponse {
  timezone?: string;
  timezone_abbreviation?: string;
  generationtime_ms?: number;
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
  };
}

function buildUrl(config: ConfigData): string {
  const params = new URLSearchParams({
    latitude: String(config.lat),
    longitude: String(config.lon),
    timezone: config.timezone,
    forecast_days: '6',
    hourly: 'temperature_2m,precipitation,precipitation_probability',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export async function fetchForecast(config: ConfigData): Promise<ForecastData> {
  const response = await fetch(buildUrl(config), {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`weather fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as OpenMeteoResponse;
  const times = data.hourly?.time ?? [];
  const temperatures = data.hourly?.temperature_2m ?? [];
  const precipitation = data.hourly?.precipitation ?? [];

  const hourly: HourForecast[] = times.map((time, index) => {
    const [date, hh = '00:00'] = time.split('T');
    const hour = Number(hh.slice(0, 2));
    const temperature = temperatures[index] ?? NaN;
    const rain = precipitation[index] ?? 0;
    const withinHours = hour >= config.startHour && hour < config.endHour;
    return {
      time,
      date: date ?? '',
      hour,
      temperature,
      precipitation: rain,
      good: withinHours && temperature >= config.minTemp && temperature <= config.maxTemp && rain <= config.maxPrecipitation,
    };
  }).filter((entry) => entry.date && Number.isFinite(entry.temperature) && Number.isFinite(entry.hour));

  return {
    timezone: data.timezone || config.timezone,
    timezoneAbbreviation: data.timezone_abbreviation,
    generatedAt: typeof data.generationtime_ms === 'number' ? String(data.generationtime_ms) : undefined,
    hourly,
  };
}
