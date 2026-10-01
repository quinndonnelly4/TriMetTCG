import type { Vehicle } from '../types';

interface StreetcarVehicleRaw {
  id?: string;
  routeTag?: string;
  dirTag?: string;
  lat?: string;
  lon?: string;
  heading?: string;
  speedKmHr?: string;
  secsSinceReport?: string;
  predictable?: string;
}

interface StreetcarFeed {
  vehicle?: StreetcarVehicleRaw | StreetcarVehicleRaw[];
}

const STALE_S = 120;

const TAG_TO_ROUTE: Record<string, string> = {
  '193': '193',
  ns: '193',
  n: '193',
  '194': '194',
  a: '194',
  aloop: '194',
  '195': '195',
  b: '195',
  bloop: '195',
};

export const STREETCAR_RIDER: Record<string, string> = {
  '193': 'NS',
  '194': 'A',
  '195': 'B',
};

export const STREETCAR_NAME: Record<string, string> = {
  '193': 'NS Line',
  '194': 'A Loop',
  '195': 'B Loop',
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function streetcarRouteNumber(tag: string | undefined): string | null {
  if (!tag) return null;
  const key = tag.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (TAG_TO_ROUTE[key]) return TAG_TO_ROUTE[key];
  const digits = tag.trim().match(/^(193|194|195)\b/);
  return digits?.[1] ?? null;
}

function headingLabel(dirTag: string | undefined): string {
  if (!dirTag) return '';
  const parts = dirTag.split('_');
  if (parts[1] === '0') return 'Inbound';
  if (parts[1] === '1') return 'Outbound';
  return '';
}

export function mapStreetcarVehicle(raw: StreetcarVehicleRaw): Vehicle | null {
  const lat = Number(raw.lat);
  const lng = Number(raw.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !raw.id) return null;
  const age = Number(raw.secsSinceReport);
  if (Number.isFinite(age) && age > STALE_S) return null;
  const routeNumber = streetcarRouteNumber(raw.routeTag);
  if (!routeNumber) return null;
  const sign = headingLabel(raw.dirTag);
  return {
    vehicleId: `sc-${raw.id}`,
    routeNumber,
    routeName: STREETCAR_NAME[routeNumber] ?? `Streetcar ${routeNumber}`,
    signMessage: sign,
    mode: 'streetcar',
    lat,
    lng,
    inService: true,
  };
}

export async function fetchStreetcarVehicles(): Promise<Vehicle[]> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch('/api/streetcar', { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as StreetcarFeed;
    return asArray(data.vehicle)
      .map(mapStreetcarVehicle)
      .filter((v): v is Vehicle => v != null);
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}
