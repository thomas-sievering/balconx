import type { ConfigData } from './types.js';

interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    state?: string;
    country?: string;
  };
  name?: string;
  display_name?: string;
}

function compact(parts: Array<string | undefined>): string {
  const unique = new Set<string>();
  for (const part of parts) {
    const trimmed = part?.trim();
    if (trimmed) unique.add(trimmed);
  }
  return Array.from(unique).join(', ');
}

export async function reverseGeocode(config: ConfigData): Promise<string> {
  if (config.locationName?.trim()) return config.locationName;
  try {
    const params = new URLSearchParams({
      lat: String(config.lat),
      lon: String(config.lon),
      format: 'jsonv2',
      zoom: '12',
      addressdetails: '1',
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: {
        accept: 'application/json',
        'accept-language': 'en',
        'user-agent': 'balconx/0.1 (+local cli)',
      },
    });
    if (!response.ok) throw new Error('reverse geocode failed');
    const data = await response.json() as NominatimResponse;
    const label = compact([
      data.address?.city,
      data.address?.town,
      data.address?.village,
      data.address?.suburb,
      data.address?.state,
      data.address?.country,
      data.name,
    ]);
    if (!label) throw new Error('empty reverse geocode result');
    return label;
  } catch {
    return `${config.lat.toFixed(3)}, ${config.lon.toFixed(3)}`;
  }
}
