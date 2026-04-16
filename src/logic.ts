import type { CurrentStatus, DaySummary, ForecastData, HourForecast, NextWindowResult, TimeWindow } from './types.js';
import { addDays } from './time.js';

export function groupWindows(hours: HourForecast[]): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let start: number | null = null;
  let previousHour: number | null = null;

  for (const hour of hours) {
    if (hour.good) {
      if (start === null) start = hour.hour;
      previousHour = hour.hour;
      continue;
    }
    if (start !== null && previousHour !== null) {
      windows.push({ startHour: start, endHour: previousHour + 1 });
      start = null;
      previousHour = null;
    }
  }

  if (start !== null && previousHour !== null) {
    windows.push({ startHour: start, endHour: previousHour + 1 });
  }

  return windows;
}

export function getDaySummary(
  forecast: ForecastData,
  date: string,
  label: string,
  startHour: number,
  endHour: number,
): DaySummary {
  const hours = forecast.hourly.filter((entry) => entry.date === date && entry.hour >= startHour && entry.hour < endHour);
  return {
    label,
    date,
    hours,
    windows: groupWindows(hours),
  };
}

export function getCurrentStatus(forecast: ForecastData, date: string, hour: number): CurrentStatus {
  const bucket = forecast.hourly.find((entry) => entry.date === date && entry.hour === hour) ?? null;
  return {
    time: `${String(hour).padStart(2, '0')}:00`,
    date,
    hour,
    bucket,
    goodNow: Boolean(bucket?.good),
  };
}

export function getNextWindow(forecast: ForecastData, currentDate: string, currentHour: number): NextWindowResult {
  const dates = Array.from(new Set(forecast.hourly.map((entry) => entry.date))).sort();

  for (const date of dates) {
    const hours = forecast.hourly.filter((entry) => entry.date === date);
    const windows = groupWindows(hours);
    for (const window of windows) {
      if (date < currentDate) continue;
      if (date === currentDate && window.endHour <= currentHour) continue;
      const dayLabel = date === currentDate ? 'today' : date === addDays(currentDate, 1) ? 'tomorrow' : 'later';
      return { dayLabel, date, window };
    }
  }

  return { dayLabel: 'later', date: addDays(currentDate, 1), window: null };
}
