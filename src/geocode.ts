import { prompt } from './config.js';
import type { ConfigData } from './types.js';

interface SearchResult {
  name?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  postcodes?: string[];
}

interface SearchResponse {
  results?: SearchResult[];
}

function compact(parts: Array<string | undefined>): string {
  const seen = new Set<string>();
  for (const part of parts) {
    const trimmed = part?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return Array.from(seen).join(', ');
}

function labelFor(result: SearchResult): string {
  const postcode = result.postcodes?.[0];
  return compact([result.name, postcode, result.admin1, result.country]);
}

export async function searchLocation(query: string): Promise<Array<{ label: string; lat: number; lon: number; timezone?: string }>> {
  const params = new URLSearchParams({
    name: query,
    count: '5',
    language: 'en',
    format: 'json',
  });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('location lookup failed');
  const data = await response.json() as SearchResponse;
  return (data.results ?? [])
    .filter((item) => typeof item.latitude === 'number' && typeof item.longitude === 'number')
    .map((item) => ({
      label: labelFor(item),
      lat: item.latitude as number,
      lon: item.longitude as number,
      timezone: item.timezone,
    }));
}

export async function promptLookupLocation(config: ConfigData, currentLabel: string): Promise<ConfigData> {
  const query = await prompt(`city / zip / place [${config.locationName ?? currentLabel}]: `);
  if (!query) return config;
  const matches = await searchLocation(query);
  if (matches.length === 0) {
    console.log('no matches found');
    return config;
  }
  matches.forEach((match, index) => {
    console.log(`${index + 1}. ${match.label} (${match.lat.toFixed(3)}, ${match.lon.toFixed(3)})`);
  });
  const choice = await prompt('pick [1]: ');
  const pickedIndex = choice ? Number(choice) - 1 : 0;
  const picked = matches[pickedIndex] ?? matches[0];
  if (!picked) return config;
  return {
    ...config,
    lat: picked.lat,
    lon: picked.lon,
    locationName: picked.label,
    timezone: picked.timezone || config.timezone,
  };
}
