import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { ConfigData } from './types.js';

export const APP_NAME = 'balconx';
export const CONFIG_DIR = path.join(os.homedir(), '.balconx');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG = {
  timezone: 'auto',
  minTemp: 14,
  maxTemp: 20,
  maxPrecipitation: 0.1,
  startHour: 8,
  endHour: 22,
} satisfies Omit<ConfigData, 'lat' | 'lon'>;

export async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

export async function readConfig(): Promise<ConfigData | null> {
  await ensureConfigDir();
  if (!fsSync.existsSync(CONFIG_PATH)) return null;
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ConfigData>;
    if (typeof parsed.lat !== 'number' || typeof parsed.lon !== 'number') return null;
    return {
      lat: parsed.lat,
      lon: parsed.lon,
      locationName: typeof parsed.locationName === 'string' && parsed.locationName.trim() ? parsed.locationName : undefined,
      timezone: typeof parsed.timezone === 'string' && parsed.timezone.trim() ? parsed.timezone : DEFAULT_CONFIG.timezone,
      minTemp: typeof parsed.minTemp === 'number' ? parsed.minTemp : DEFAULT_CONFIG.minTemp,
      maxTemp: typeof parsed.maxTemp === 'number' ? parsed.maxTemp : DEFAULT_CONFIG.maxTemp,
      maxPrecipitation: typeof parsed.maxPrecipitation === 'number' ? parsed.maxPrecipitation : DEFAULT_CONFIG.maxPrecipitation,
      startHour: typeof parsed.startHour === 'number' ? parsed.startHour : DEFAULT_CONFIG.startHour,
      endHour: typeof parsed.endHour === 'number' ? parsed.endHour : DEFAULT_CONFIG.endHour,
    };
  } catch {
    return null;
  }
}

export async function writeConfig(config: ConfigData): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

export async function promptNumber(question: string): Promise<number> {
  while (true) {
    const value = await prompt(question);
    const num = Number(value.replace(',', '.'));
    if (Number.isFinite(num)) return num;
    console.log('please enter a number');
  }
}

function clampHour(value: number, fallback: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function getDefaultConfigValues(): Omit<ConfigData, 'lat' | 'lon'> {
  return { ...DEFAULT_CONFIG };
}

export async function promptFullConfig(existing?: ConfigData | null): Promise<ConfigData> {
  const defaults = existing ?? {
    lat: 0,
    lon: 0,
    ...DEFAULT_CONFIG,
  };
  const lat = await promptNumber(`latitude [${defaults.lat || ''}]: `);
  const lon = await promptNumber(`longitude [${defaults.lon || ''}]: `);
  const timezoneInput = await prompt(`timezone [${defaults.timezone}]: `);
  const startHourInput = await prompt(`start hour [${defaults.startHour}]: `);
  const endHourInput = await prompt(`end hour [${defaults.endHour}]: `);
  const config: ConfigData = {
    lat,
    lon,
    locationName: defaults.locationName,
    timezone: timezoneInput || defaults.timezone,
    minTemp: defaults.minTemp,
    maxTemp: defaults.maxTemp,
    maxPrecipitation: defaults.maxPrecipitation,
    startHour: clampHour(startHourInput ? Number(startHourInput) : defaults.startHour, defaults.startHour, 0, 23),
    endHour: clampHour(endHourInput ? Number(endHourInput) : defaults.endHour, defaults.endHour, 1, 24),
  };
  return config.endHour <= config.startHour ? { ...config, endHour: Math.min(24, config.startHour + 1) } : config;
}

export async function ensureConfigInteractive(existing?: ConfigData | null): Promise<ConfigData> {
  if (existing) return existing;
  console.log('balconx setup');
  const config = await promptFullConfig(existing);
  await writeConfig(config);
  console.log(`saved ${CONFIG_PATH}`);
  return config;
}

export async function promptEditLocation(config: ConfigData): Promise<ConfigData> {
  return config;
}

export async function promptEditHours(config: ConfigData): Promise<ConfigData> {
  const startHourInput = await prompt(`start hour [${config.startHour}]: `);
  const endHourInput = await prompt(`end hour [${config.endHour}]: `);
  const startHour = clampHour(startHourInput ? Number(startHourInput) : config.startHour, config.startHour, 0, 23);
  const endHour = clampHour(endHourInput ? Number(endHourInput) : config.endHour, config.endHour, 1, 24);
  return { ...config, startHour, endHour: endHour <= startHour ? Math.min(24, startHour + 1) : endHour };
}

export async function promptEditTemperature(config: ConfigData): Promise<ConfigData> {
  const minInput = await prompt(`min temp [${config.minTemp}]: `);
  const maxInput = await prompt(`max temp [${config.maxTemp}]: `);
  const minTempValue = minInput ? Number(minInput.replace(',', '.')) : config.minTemp;
  const maxTempValue = maxInput ? Number(maxInput.replace(',', '.')) : config.maxTemp;
  const minTemp = Number.isFinite(minTempValue) ? minTempValue : config.minTemp;
  const maxTemp = Number.isFinite(maxTempValue) ? maxTempValue : config.maxTemp;
  return { ...config, minTemp, maxTemp: maxTemp < minTemp ? minTemp : maxTemp };
}

export async function promptEditRain(config: ConfigData): Promise<ConfigData> {
  const rainInput = await prompt(`max precipitation [${config.maxPrecipitation}]: `);
  const maxPrecipitation = rainInput ? Number(rainInput.replace(',', '.')) : config.maxPrecipitation;
  return { ...config, maxPrecipitation: Number.isFinite(maxPrecipitation) ? maxPrecipitation : config.maxPrecipitation };
}
