import type { ConfigData, CurrentStatus, DaySummary, ForecastData, NextWindowResult } from './types.js';
import { formatDisplayDate, formatHour, formatWindow } from './time.js';

export type Screen = 'day' | 'settings';

function clearScreen(): void {
  process.stdout.write('\x1Bc');
}

function dim(text: string): string {
  return process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;
}

function bold(text: string): string {
  return process.stdout.isTTY ? `\x1b[1m${text}\x1b[0m` : text;
}

function cyan(text: string): string {
  return process.stdout.isTTY ? `\x1b[38;5;117m${text}\x1b[0m` : text;
}

function green(text: string): string {
  return process.stdout.isTTY ? `\x1b[38;5;109m${text}\x1b[0m` : text;
}

function yellow(text: string): string {
  return process.stdout.isTTY ? `\x1b[38;5;180m${text}\x1b[0m` : text;
}

function blue(text: string): string {
  return process.stdout.isTTY ? `\x1b[38;5;111m${text}\x1b[0m` : text;
}

function statusWord(value: boolean): string {
  return value ? green('yes') : yellow('no');
}

function rainWord(amount: number): string {
  if (amount <= 0.1) return 'dry';
  if (amount < 1) return 'light rain';
  return 'rain';
}

function renderWindows(summary: DaySummary): string[] {
  if (summary.windows.length === 0) return [dim('none')];
  return summary.windows.map((window) => cyan(formatWindow(window.startHour, window.endHour)));
}

function nextLine(next: NextWindowResult, current: CurrentStatus): string {
  if (!next.window) return 'none in current forecast';
  if (next.dayLabel === 'today' && current.goodNow && next.window.startHour <= current.hour) {
    return `now – ${formatHour(next.window.endHour)}`;
  }
  return next.dayLabel === 'today'
    ? `${formatWindow(next.window.startHour, next.window.endHour)}`
    : `${next.dayLabel} ${formatWindow(next.window.startHour, next.window.endHour)}`;
}

function renderWideTimeline(summary: DaySummary, options?: { currentHour?: number; markCurrent?: boolean }): string[] {
  if (summary.hours.length === 0) return [dim('no data')];

  const hourCells = summary.hours.map((item) => (item.hour % 2 === 0 ? `${String(item.hour).padStart(2, '0')} ` : '   '));
  const stateCells = summary.hours.map((item) => {
    if (item.precipitation > 0.1) return blue('≋≋≋');
    if (item.good) return green('███');
    return dim('···');
  });
  const nowCells = summary.hours.map((item) => (options?.markCurrent && options.currentHour === item.hour ? yellow('↑  ') : '   '));

  const lastHour = summary.hours.at(-1)?.hour;
  const closingLabel = typeof lastHour === 'number' ? String(lastHour + 1).padStart(2, '0') : '';

  const lines = [
    `hours ${hourCells.join('')}${closingLabel}`,
    `time  ${stateCells.join('')}`,
  ];
  if (options?.markCurrent) lines.push(`now   ${nowCells.join('').trimEnd()}`);
  return lines;
}

function renderHeader(locationLabel: string, forecast: ForecastData, current: CurrentStatus): void {
  console.log(bold('balconx'));
  console.log(dim(locationLabel));
  console.log(dim(`${formatDisplayDate(current.date)} ${current.time}  ${forecast.timezone}${forecast.timezoneAbbreviation ? ` (${forecast.timezoneAbbreviation})` : ''}`));
  console.log('');
}

export function renderScreen(options: {
  screen: Screen;
  dayIndex: number;
  config: ConfigData;
  locationLabel: string;
  forecast: ForecastData;
  current: CurrentStatus;
  summaries: DaySummary[];
  next: NextWindowResult;
}): void {
  clearScreen();
  const { screen, dayIndex, config, locationLabel, current, summaries, next, forecast } = options;
  renderHeader(locationLabel, forecast, current);

  if (screen === 'day') {
    const summary = summaries[dayIndex] ?? summaries[0];
    const title = summary?.label ?? 'today';
    if (current.bucket) {
      console.log(`${bold(current.bucket.temperature.toFixed(1) + '°C')}  ${rainWord(current.bucket.precipitation)}  outside ${statusWord(current.goodNow)}`);
      console.log(`next  ${cyan(nextLine(next, current))}`);
      console.log(`range ${config.minTemp}–${config.maxTemp}°C  rain ≤ ${config.maxPrecipitation}  hours ${formatHour(config.startHour)}–${formatHour(config.endHour)}`);
      console.log('');
    }
    console.log(bold(`${title} ${dim('·')} ${formatDisplayDate(summary.date)}`));
    console.log('');
    for (const line of renderWideTimeline(summary, { currentHour: current.hour, markCurrent: dayIndex === 0 })) console.log(line);
    console.log('');
    for (const line of renderWindows(summary)) console.log(line);
    console.log('');
    console.log(dim('[←][→] day  [s] settings  [r] refresh  [q] quit'));
    return;
  }

  console.log(bold('settings'));
  console.log('');
  console.log(`location  ${locationLabel}`);
  console.log(`search    ${config.locationName ?? dim('reverse-geocoded from coords')}`);
  console.log(`coords    ${config.lat.toFixed(4)}, ${config.lon.toFixed(4)}`);
  console.log(`timezone  ${config.timezone}`);
  console.log(`hours     ${formatHour(config.startHour)}–${formatHour(config.endHour)}`);
  console.log(`temp      ${config.minTemp}–${config.maxTemp}°C`);
  console.log(`rain      ≤ ${config.maxPrecipitation}`);
  console.log('');
  console.log(dim('[l] lookup place  [h] hours  [t] temp  [p] rain  [esc] back  [r] refresh  [q] quit'));
}

export function renderJson(payload: unknown): void {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}
