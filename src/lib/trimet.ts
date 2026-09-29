import type { CardDef, GeoPoint, TransitMode, Vehicle } from '../types';
import { haversineMeters } from './geo';
import { recordTrimetQuery } from './trimetQueries';

interface TrimetVehicleRaw {
  vehicleID?: number | string;
  routeNumber?: number | string;
  type?: string;
  latitude?: number;
  longitude?: number;
  signMessage?: string;
  signMessageLong?: string;
  delay?: number;
  bearing?: number;
  tripID?: number | string;
  offRoute?: boolean | string;
}

interface TrimetResponse {
  resultSet?: {
    vehicle?: TrimetVehicleRaw | TrimetVehicleRaw[];
    errorMessage?: { content?: string } | string;
  };
}

/** GTFS / vehicles route IDs: 90 Red, 100 Blue (easy to mix up). */
const MAX_ROUTES: Record<string, string> = {
  '90': 'MAX Red',
  '100': 'MAX Blue',
  '190': 'MAX Yellow',
  '200': 'MAX Green',
  '290': 'MAX Orange',
};

type MaxColor = 'blue' | 'red' | 'yellow' | 'green' | 'orange';

const MAX_COLOR_BY_ROUTE: Record<string, MaxColor> = {
  '90': 'red',
  '100': 'blue',
  '190': 'yellow',
  '200': 'green',
  '290': 'orange',
};

const WES_ROUTES = new Set(['203']);
const STREETCAR_ROUTES = new Set(['193', '194', '195']);

export function classifyMode(routeNumber: string, apiType?: string): TransitMode {
  const type = (apiType ?? '').toUpperCase();
  if (WES_ROUTES.has(routeNumber)) return 'wes';
  if (STREETCAR_ROUTES.has(routeNumber) || type === 'S') return 'streetcar';
  if (MAX_ROUTES[routeNumber] || type === 'R' || apiType === 'rail') return 'max';
  return 'bus';
}

function maxColorFromText(text: string): MaxColor | null {
  const match = text.toLowerCase().match(/(?:max\s+)?(yellow|orange|green|blue|red)\s+line\b/);
  return (match?.[1] as MaxColor | undefined) ?? null;
}

function titleMaxColor(color: MaxColor): string {
  return `MAX ${color[0].toUpperCase()}${color.slice(1)}`;
}

export function routeDisplayName(
  routeNumber: string,
  mode: TransitMode,
  apiDesc?: string,
  signMessage?: string,
): string {
  const fromSign = mode === 'max' && signMessage ? maxColorFromText(signMessage) : null;
  if (fromSign) return titleMaxColor(fromSign);
  if (MAX_ROUTES[routeNumber]) return MAX_ROUTES[routeNumber];
  if (mode === 'wes') return 'WES';
  if (mode === 'streetcar') return apiDesc || `Streetcar ${routeNumber}`;
  if (apiDesc) return apiDesc.replace(/^\d+\s*-\s*/, 'Line ').replace(/^Line Line /, 'Line ');
  return `Line ${routeNumber}`;
}

export function modeLabel(mode: TransitMode): string {
  if (mode === 'max') return 'MAX';
  if (mode === 'wes') return 'WES';
  if (mode === 'streetcar') return 'Streetcar';
  return 'Bus';
}

/** Rider-facing line id. MAX numbers stay internal. */
export function riderRouteLabel(mode: TransitMode, routeNumber: string): string {
  if (mode === 'max') return 'MAX';
  return routeNumber;
}

export function maxLineColor(routeNumber: string, signOrName?: string): MaxColor | null {
  return maxColorFromText(signOrName ?? '') ?? MAX_COLOR_BY_ROUTE[routeNumber] ?? null;
}

export function routeBadgeClass(mode: TransitMode, routeNumber: string, signOrName?: string): string {
  const line = mode === 'max' ? maxLineColor(routeNumber, signOrName) : null;
  if (line) return `mode-badge mode-max max-${line}`;
  return `mode-badge mode-${mode}`;
}

/** Drop duplicated "MAX Blue Line to" so the row can show destination only. */
export function formatHeadsign(sign: string, routeName?: string): string {
  let text = sign.replace(/\s+/g, ' ').trim();
  const color = maxColorFromText(`${routeName ?? ''} ${text}`);
  if (color) {
    text = text.replace(new RegExp(`^MAX\\s+${color}\\s+Line\\s+to\\s+`, 'i'), '');
    text = text.replace(new RegExp(`^${color}\\s+Line\\s+to\\s+`, 'i'), '');
  }
  return text.replace(/^to\s+/i, '').trim();
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

async function trimetGet(pathAndQuery: string): Promise<TrimetResponse> {
  recordTrimetQuery();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`/api/trimet${pathAndQuery}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`TriMet HTTP ${res.status}`);
    return (await res.json()) as TrimetResponse;
  } finally {
    window.clearTimeout(timer);
  }
}

export function packWeightForRide(card: CardDef, mode: TransitMode): number {
  const base: Record<CardDef['rarity'], number> = {
    common: 60,
    uncommon: 28,
    rare: 10,
    legendary: 2,
  };
  let w = base[card.rarity];
  if (card.unlockBias && card.unlockBias === mode) w *= 1.8;
  return w;
}

function vehicleIsInService(raw: TrimetVehicleRaw): boolean {
  if (raw.offRoute === true || raw.offRoute === 'true') return false;
  const route = String(raw.routeNumber ?? '').trim();
  if (!route || route === '0') return false;
  if (raw.tripID == null || String(raw.tripID).trim() === '') return false;
  const sign = `${raw.signMessage ?? ''} ${raw.signMessageLong ?? ''}`.toLowerCase();
  if (/\bnot in service\b|\bout of service\b|\bto garage\b|\bdeadhead\b/.test(sign)) return false;
  return true;
}

function mapVehicle(raw: TrimetVehicleRaw): Vehicle | null {
  if (raw.latitude == null || raw.longitude == null || raw.vehicleID == null) return null;
  if (!vehicleIsInService(raw)) return null;
  const routeNumber = String(raw.routeNumber ?? '');
  const mode = classifyMode(routeNumber, raw.type);
  const signMessage = raw.signMessageLong || raw.signMessage || '';
  return {
    vehicleId: String(raw.vehicleID),
    routeNumber,
    routeName: routeDisplayName(routeNumber, mode, undefined, signMessage),
    signMessage,
    mode,
    lat: raw.latitude,
    lng: raw.longitude,
    delaySeconds: raw.delay,
    bearing: raw.bearing,
    inService: true,
  };
}

export function companionVehicles(origin: GeoPoint, routes: string[]): Vehicle[] {
  const catalog: Record<string, Omit<Vehicle, 'lat' | 'lng'>> = {
    '90': {
      vehicleId: 'sim-red',
      routeNumber: '90',
      routeName: 'MAX Red',
      signMessage: 'To Portland Airport',
      mode: 'max',
      inService: true,
    },
    '100': {
      vehicleId: 'sim-blue',
      routeNumber: '100',
      routeName: 'MAX Blue',
      signMessage: 'To Hillsboro',
      mode: 'max',
      inService: true,
    },
    '20': {
      vehicleId: 'sim-20',
      routeNumber: '20',
      routeName: 'Line 20',
      signMessage: 'To Gresham TC',
      mode: 'bus',
      inService: true,
    },
    '190': {
      vehicleId: 'sim-yellow',
      routeNumber: '190',
      routeName: 'MAX Yellow',
      signMessage: 'To Expo Center',
      mode: 'max',
      inService: true,
    },
    '200': {
      vehicleId: 'sim-green',
      routeNumber: '200',
      routeName: 'MAX Green',
      signMessage: 'To Clackamas TC',
      mode: 'max',
      inService: true,
    },
    '290': {
      vehicleId: 'sim-orange',
      routeNumber: '290',
      routeName: 'MAX Orange',
      signMessage: 'To Union Station',
      mode: 'max',
      inService: true,
    },
  };
  const out: Vehicle[] = [];
  routes.forEach((n, i) => {
    const base = catalog[n];
    if (!base) return;
    const jitter = i * 0.00004;
    const lat = origin.lat + jitter;
    const lng = origin.lng - jitter;
    out.push({
      ...base,
      lat,
      lng,
      distanceMeters: haversineMeters(origin, { lat, lng }),
    });
  });
  return out;
}

export function companionVehiclesAt(vehicleAt: GeoPoint, user: GeoPoint, routes: string[]): Vehicle[] {
  return companionVehicles(vehicleAt, routes).map((v) => ({
    ...v,
    distanceMeters: haversineMeters(user, { lat: v.lat, lng: v.lng }),
  }));
}

export async function fetchVehicles(origin?: GeoPoint): Promise<Vehicle[]> {
  try {
    const qs = new URLSearchParams({
      json: 'true',
      onRouteOnly: 'true',
      showNonRevenue: 'false',
    });
    const data = await trimetGet(`/ws/v2/vehicles?${qs}`);
    const list = asArray(data.resultSet?.vehicle)
      .map(mapVehicle)
      .filter((v): v is Vehicle => v != null);
    if (!origin) return list;
    return list
      .map((v) => ({ ...v, distanceMeters: haversineMeters(origin, { lat: v.lat, lng: v.lng }) }))
      .filter((v) => (v.distanceMeters ?? Infinity) <= 250)
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  } catch {
    return [];
  }
}
