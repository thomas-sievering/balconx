import { describe, expect, test } from 'bun:test';
import { addDays, formatWindow, getDateParts } from './time.js';

describe('time helpers', () => {
  test('adds days safely', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('formats windows', () => {
    expect(formatWindow(8, 22)).toBe('08:00–22:00');
  });

  test('gets date parts in requested timezone', () => {
    const parts = getDateParts('Europe/Berlin', new Date('2026-04-16T21:30:00Z'));
    expect(parts.date).toBe('2026-04-16');
    expect(parts.hour).toBe(23);
  });
});
