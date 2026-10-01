import { ONBOARD_RADIUS_M, haversineMeters } from './geo';
import type { GpsSample, OnboardGuess, Vehicle } from '../types';

export function guessOnboardLines(samples: GpsSample[], vehicles: Vehicle[]): OnboardGuess[] {
  const here = samples[samples.length - 1];
  if (!here) return [];

  const near = vehicles
    .filter((v) => v.inService)
    .map((v) => ({
      vehicle: v,
      distanceMeters: haversineMeters(here, { lat: v.lat, lng: v.lng }),
    }))
    .filter((x) => x.distanceMeters <= ONBOARD_RADIUS_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const bestByRoute = new Map<string, OnboardGuess>();
  for (const hit of near) {
    const key = hit.vehicle.routeNumber;
    if (bestByRoute.has(key)) continue;
    bestByRoute.set(key, {
      vehicle: { ...hit.vehicle, distanceMeters: hit.distanceMeters },
      distanceMeters: hit.distanceMeters,
    });
  }

  return [...bestByRoute.values()];
}
