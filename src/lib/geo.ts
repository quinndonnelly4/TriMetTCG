import type { GeoPoint } from '../types';

const EARTH_M = 6371000;

export const DOWNTOWN_PDX: GeoPoint = { lat: 45.5187, lng: -122.6784 };
/** NS Line northern terminus, NW 23rd Ave & NW Marshall St. */
export const NW_23RD_MARSHALL: GeoPoint = { lat: 45.53051, lng: -122.69864 };
export const ONBOARD_RADIUS_M = 80;
export const RIDE_CONFIRM_RADIUS_M = 40;
export const RIDE_CONFIRM_MOVE_M = 80;
export const COOLDOWN_MS = 60 * 60 * 1000;

/** Simplified downtown MAX spine used by ride-confirm debug sims */
export const SIM_MAX_PATH: GeoPoint[] = [
  { lat: 45.5187, lng: -122.6784 },
  { lat: 45.5198, lng: -122.6752 },
  { lat: 45.5234, lng: -122.6711 },
  { lat: 45.5265, lng: -122.6634 },
  { lat: 45.5289, lng: -122.6558 },
];

export const SIM_TICK_MS = 900;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function pathLengthMeters(path: GeoPoint[]): number {
  let sum = 0;
  for (let i = 1; i < path.length; i++) sum += haversineMeters(path[i - 1], path[i]);
  return sum;
}

export function pointAlongPath(path: GeoPoint[], distanceM: number, loop = true): GeoPoint {
  if (path.length === 0) return DOWNTOWN_PDX;
  const total = Math.max(pathLengthMeters(path), 1);
  let remain = loop ? distanceM % total : Math.min(distanceM, total);
  if (!loop && distanceM >= total) return path[path.length - 1];
  for (let i = 1; i < path.length; i++) {
    const seg = haversineMeters(path[i - 1], path[i]);
    if (remain <= seg) {
      const t = seg === 0 ? 0 : remain / seg;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
      };
    }
    remain -= seg;
  }
  return path[path.length - 1];
}

export type SimKind =
  | 'downtown'
  | 'ride-ok'
  | 'ride-miss'
  | 'max-all'
  | 'checkin'
  | 'checkin-miss'
  | 'checkin-streetcar'
  | 'ns-23rd';

export interface SimConfig {
  kind: SimKind;
  path: GeoPoint[];
  routes: string[];
  label: string;
  start: GeoPoint;
  speedMps: number;
  loop: boolean;
  gpsFollowsVehicle: boolean;
  autoConfirm?: boolean;
}

const RIDE_CONFIRM_SIM_MPS = 12;

export function parseSimQuery(search: string): SimConfig | null {
  const params = new URLSearchParams(search);
  const sim = params.get('sim');
  if (sim === 'downtown') {
    return {
      kind: 'downtown',
      path: [DOWNTOWN_PDX],
      routes: [],
      label: 'Still at Pioneer Square',
      start: DOWNTOWN_PDX,
      speedMps: 0,
      loop: false,
      gpsFollowsVehicle: false,
    };
  }
  if (sim === 'ns-23rd') {
    return {
      kind: 'ns-23rd',
      path: [NW_23RD_MARSHALL],
      routes: [],
      label: 'Still at NW 23rd & Marshall',
      start: NW_23RD_MARSHALL,
      speedMps: 0,
      loop: false,
      gpsFollowsVehicle: false,
    };
  }
  if (sim === 'ride-ok' || sim === 'checkin') {
    return {
      kind: sim,
      path: SIM_MAX_PATH,
      routes: ['90'],
      label: sim === 'checkin' ? 'Check-in HUD pass' : 'Ride 80 m pass',
      start: SIM_MAX_PATH[0],
      speedMps: RIDE_CONFIRM_SIM_MPS,
      loop: false,
      gpsFollowsVehicle: true,
      autoConfirm: sim === 'checkin',
    };
  }
  if (sim === 'ride-miss' || sim === 'checkin-miss') {
    return {
      kind: sim,
      path: SIM_MAX_PATH,
      routes: ['20'],
      label: sim === 'checkin-miss' ? 'Check-in HUD stay put' : 'Ride 80 m stay put',
      start: SIM_MAX_PATH[0],
      speedMps: RIDE_CONFIRM_SIM_MPS,
      loop: false,
      gpsFollowsVehicle: false,
      autoConfirm: sim === 'checkin-miss',
    };
  }
  if (sim === 'checkin-streetcar') {
    return {
      kind: 'checkin-streetcar',
      path: SIM_MAX_PATH,
      routes: ['193'],
      label: 'Check-in HUD streetcar',
      start: SIM_MAX_PATH[0],
      speedMps: RIDE_CONFIRM_SIM_MPS,
      loop: false,
      gpsFollowsVehicle: true,
      autoConfirm: true,
    };
  }
  if (sim === 'max-all') {
    return {
      kind: 'max-all',
      path: SIM_MAX_PATH,
      routes: ['90', '100', '190', '200', '290'],
      label: 'All MAX lines',
      start: SIM_MAX_PATH[0],
      speedMps: RIDE_CONFIRM_SIM_MPS,
      loop: false,
      gpsFollowsVehicle: true,
    };
  }
  return null;
}

export function debugMode(search: string): boolean {
  return new URLSearchParams(search).get('debug') !== '0';
}
