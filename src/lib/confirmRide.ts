import {
  ONBOARD_RADIUS_M,
  RIDE_CONFIRM_MOVE_M,
  RIDE_CONFIRM_RADIUS_M,
  haversineMeters,
} from './geo';
import type { GeoPoint } from '../types';

export interface ConfirmSample {
  pickM: number;
  vehicleMovedM: number;
  riderMovedM: number;
  separationM: number;
  a: boolean;
  b: boolean;
  c: boolean;
  d: boolean;
  pass: boolean;
}

export function sampleConfirm(input: {
  pickM: number;
  riderStart: GeoPoint;
  vehicleStart: GeoPoint;
  riderNow: GeoPoint;
  vehicleNow: GeoPoint;
}): ConfirmSample {
  const vehicleMovedM = haversineMeters(input.vehicleStart, input.vehicleNow);
  const riderMovedM = haversineMeters(input.riderStart, input.riderNow);
  const separationM = haversineMeters(input.riderNow, input.vehicleNow);
  const a = input.pickM <= ONBOARD_RADIUS_M;
  const b = vehicleMovedM >= RIDE_CONFIRM_MOVE_M;
  const c = riderMovedM >= RIDE_CONFIRM_MOVE_M;
  const d = separationM <= RIDE_CONFIRM_RADIUS_M;
  return {
    pickM: input.pickM,
    vehicleMovedM,
    riderMovedM,
    separationM,
    a,
    b,
    c,
    d,
    pass: a && b && c && d,
  };
}

export function metersLabel(meters: number): string {
  return `${Math.round(meters)} m`;
}
