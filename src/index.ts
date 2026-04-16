#!/usr/bin/env node
import { stdin as input, stdout as output, exit } from 'node:process';
import * as fsSync from 'node:fs';
import {
  APP_NAME,
  CONFIG_PATH,
  ensureConfigInteractive,
  promptEditHours,
  promptEditRain,
  promptEditTemperature,
  readConfig,
  writeConfig,
} from './config.js';
import { promptLookupLocation } from './geocode.js';
import { getCurrentStatus, getDaySummary, getNextWindow } from './logic.js';
import { reverseGeocode } from './location.js';
import { renderJson, renderScreen, type Screen } from './render.js';
import { addDays, formatWindow, getDateParts } from './time.js';
import type { ConfigData, ForecastData } from './types.js';
import { fetchForecast } from './weather.js';

const HELP_FLAGS = new Set(['-h', '--help']);
const VERSION_FLAGS = new Set(['-v', '--version']);

type JsonMode = 'now' | 'today' | 'tomorrow' | 'next';

function getVersion(): string {
  try {
    const raw = fsSync.readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function printHelp(): void {
  console.log(`${APP_NAME} ${getVersion()}`);
  console.log('');
  console.log('Usage:');
  console.log(`  ${APP_NAME}              start app`);
  console.log(`  ${APP_NAME} --json now`);
  console.log(`  ${APP_NAME} --json today`);
  console.log(`  ${APP_NAME} --json tomorrow`);
  console.log(`  ${APP_NAME} --json next`);
  console.log('');
  console.log(`Config: ${CONFIG_PATH}`);
}

const MAX_DAY_INDEX = 5;

async function loadAppData(config: ConfigData): Promise<{
  locationLabel: string;
  forecast: ForecastData;
  summaries: ReturnType<typeof getDaySummary>[];
  current: ReturnType<typeof getCurrentStatus>;
  next: ReturnType<typeof getNextWindow>;
}> {
  const [forecast, locationLabel] = await Promise.all([
    fetchForecast(config),
    reverseGeocode(config),
  ]);
  const timeZone = forecast.timezone || config.timezone;
  const now = getDateParts(timeZone);
  const todayDate = now.date;
  const current = getCurrentStatus(forecast, todayDate, now.hour);
  const summaries = Array.from({ length: MAX_DAY_INDEX + 1 }, (_, offset) => {
    const date = addDays(todayDate, offset);
    const label = offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : `+${offset}d`;
    return getDaySummary(forecast, date, label, config.startHour, config.endHour);
  });
  const next = getNextWindow(forecast, todayDate, now.hour);
  return { locationLabel, forecast, summaries, current, next };
}

function buildJson(mode: JsonMode, data: Awaited<ReturnType<typeof loadAppData>>): unknown {
  if (mode === 'now') {
    return {
      mode,
      location: data.locationLabel,
      date: data.current.date,
      time: data.current.time,
      goodNow: data.current.goodNow,
      temperature: data.current.bucket?.temperature ?? null,
      precipitation: data.current.bucket?.precipitation ?? null,
      timezone: data.forecast.timezone,
    };
  }
  if (mode === 'today' || mode === 'tomorrow') {
    const summary = mode === 'today' ? data.summaries[0]! : data.summaries[1]!;
    return {
      mode,
      location: data.locationLabel,
      date: summary.date,
      timezone: data.forecast.timezone,
      windows: summary.windows.map((window) => ({
        startHour: window.startHour,
        endHour: window.endHour,
        label: formatWindow(window.startHour, window.endHour),
      })),
    };
  }
  return {
    mode,
    location: data.locationLabel,
    timezone: data.forecast.timezone,
    next: data.next.window ? {
      day: data.next.dayLabel,
      date: data.next.date,
      startHour: data.next.window.startHour,
      endHour: data.next.window.endHour,
      label: formatWindow(data.next.window.startHour, data.next.window.endHour),
    } : null,
  };
}

async function runJsonMode(mode: JsonMode): Promise<void> {
  const config = await ensureConfigInteractive(await readConfig());
  const data = await loadAppData(config);
  renderJson(buildJson(mode, data));
}

async function runApp(): Promise<void> {
  let config = await ensureConfigInteractive(await readConfig());
  let screen: Screen = 'day';
  let dayIndex = 0;
  let data = await loadAppData(config);

  const oldRaw = input.isRaw;
  if (input.isTTY) input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');

  const render = () => renderScreen({ screen, dayIndex, config, ...data });
  render();

  const setRawMode = (value: boolean) => {
    if (input.isTTY) input.setRawMode(value);
  };

  const promptEdit = async (kind: 'location' | 'hours' | 'temp' | 'rain') => {
    input.off('data', onData);
    setRawMode(false);
    try {
      process.stdout.write('\n');
      if (kind === 'location') config = await promptLookupLocation(config, data.locationLabel);
      if (kind === 'hours') config = await promptEditHours(config);
      if (kind === 'temp') config = await promptEditTemperature(config);
      if (kind === 'rain') config = await promptEditRain(config);
      await writeConfig(config);
      renderLoading('refreshing...');
      data = await loadAppData(config);
    } finally {
      input.resume();
      setRawMode(true);
      input.on('data', onData);
    }
  };

  const onKey = async (key: string) => {
    const lower = key.toLowerCase();
    if (key === '\u0003' || lower === 'q') {
      cleanup();
      return;
    }
    if (key === '\u001b') {
      screen = 'day';
      render();
      return;
    }
    if (screen === 'settings') {
      if (lower === 'l') await promptEdit('location');
      else if (lower === 'h') await promptEdit('hours');
      else if (lower === 't') await promptEdit('temp');
      else if (lower === 'p') await promptEdit('rain');
      else if (lower === 'r') {
        renderLoading('refreshing...');
        data = await loadAppData(config);
      }
      render();
      return;
    }

    if (key === '\u001b[C' || lower === 'l') dayIndex = Math.min(MAX_DAY_INDEX, dayIndex + 1);
    else if (key === '\u001b[D' || lower === 'h') dayIndex = Math.max(0, dayIndex - 1);
    else if (lower === 's') screen = 'settings';
    else if (lower === 'r') {
      renderLoading('refreshing...');
      data = await loadAppData(config);
    }
    render();
  };

  function renderLoading(label: string): void {
    process.stdout.write('\x1Bc');
    console.log('balconx');
    console.log('');
    console.log(label);
  }

  function cleanup(): void {
    input.off('data', onData);
    setRawMode(Boolean(oldRaw));
    input.pause();
    process.stdout.write('\x1Bc');
    exit(0);
  }

  const onData = (key: string | Buffer) => {
    void onKey(String(key)).catch((error) => {
      setRawMode(Boolean(oldRaw));
      console.error(`${APP_NAME}: ${error instanceof Error ? error.message : String(error)}`);
      exit(1);
    });
  };

  input.on('data', onData);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    printHelp();
    return;
  }
  if (args.some((arg) => VERSION_FLAGS.has(arg))) {
    console.log(getVersion());
    return;
  }
  const jsonIndex = args.indexOf('--json');
  if (jsonIndex >= 0) {
    const mode = args[jsonIndex + 1] as JsonMode | undefined;
    if (!mode || !['now', 'today', 'tomorrow', 'next'].includes(mode)) {
      throw new Error('use --json now|today|tomorrow|next');
    }
    await runJsonMode(mode);
    return;
  }
  await runApp();
}

main().catch((error) => {
  console.error(`${APP_NAME}: ${error instanceof Error ? error.message : String(error)}`);
  exit(1);
});
