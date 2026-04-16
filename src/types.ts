export interface ConfigData {
  lat: number;
  lon: number;
  locationName?: string;
  timezone: string;
  minTemp: number;
  maxTemp: number;
  maxPrecipitation: number;
  startHour: number;
  endHour: number;
}

export interface HourForecast {
  time: string;
  date: string;
  hour: number;
  temperature: number;
  precipitation: number;
  good: boolean;
}

export interface ForecastData {
  timezone: string;
  timezoneAbbreviation?: string;
  generatedAt?: string;
  hourly: HourForecast[];
}

export interface TimeWindow {
  startHour: number;
  endHour: number;
}

export interface DaySummary {
  label: string;
  date: string;
  hours: HourForecast[];
  windows: TimeWindow[];
}

export interface NextWindowResult {
  dayLabel: 'today' | 'tomorrow' | 'later';
  date: string;
  window: TimeWindow | null;
}

export interface CurrentStatus {
  time: string;
  date: string;
  hour: number;
  bucket: HourForecast | null;
  goodNow: boolean;
}
