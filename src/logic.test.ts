import { describe, expect, test } from 'bun:test';
import { getCurrentStatus, getDaySummary, getNextWindow, groupWindows } from './logic.js';
import type { ForecastData, HourForecast } from './types.js';

function hour(date: string, h: number, good: boolean): HourForecast {
  return {
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    date,
    hour: h,
    temperature: good ? 16 : 10,
    precipitation: good ? 0 : 0.5,
    good,
  };
}

describe('logic', () => {
  test('groups contiguous windows', () => {
    const hours = [hour('2026-04-16', 8, false), hour('2026-04-16', 9, true), hour('2026-04-16', 10, true), hour('2026-04-16', 11, false), hour('2026-04-16', 12, true)];
    expect(groupWindows(hours)).toEqual([
      { startHour: 9, endHour: 11 },
      { startHour: 12, endHour: 13 },
    ]);
  });

  test('day summary filters by configured hours', () => {
    const forecast: ForecastData = {
      timezone: 'Europe/Berlin',
      hourly: [hour('2026-04-16', 7, true), hour('2026-04-16', 8, true), hour('2026-04-16', 22, true)],
    };
    const summary = getDaySummary(forecast, '2026-04-16', 'today', 8, 22);
    expect(summary.hours.map((entry) => entry.hour)).toEqual([8]);
    expect(summary.windows).toEqual([{ startHour: 8, endHour: 9 }]);
  });

  test('next window can be later today or tomorrow', () => {
    const forecast: ForecastData = {
      timezone: 'Europe/Berlin',
      hourly: [hour('2026-04-16', 8, false), hour('2026-04-16', 9, true), hour('2026-04-16', 10, true), hour('2026-04-17', 8, true)],
    };
    expect(getNextWindow(forecast, '2026-04-16', 8)).toEqual({
      dayLabel: 'today',
      date: '2026-04-16',
      window: { startHour: 9, endHour: 11 },
    });
    expect(getNextWindow(forecast, '2026-04-16', 11)).toEqual({
      dayLabel: 'tomorrow',
      date: '2026-04-17',
      window: { startHour: 8, endHour: 9 },
    });
  });

  test('current status uses exact local bucket', () => {
    const forecast: ForecastData = {
      timezone: 'Europe/Berlin',
      hourly: [hour('2026-04-16', 14, true)],
    };
    const current = getCurrentStatus(forecast, '2026-04-16', 14);
    expect(current.goodNow).toBe(true);
    expect(current.bucket?.hour).toBe(14);
  });
});
