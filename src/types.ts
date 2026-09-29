export type TransitMode = 'bus' | 'max' | 'wes' | 'streetcar';
export type RideSource = 'nearby' | 'manual' | 'onboard';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type CardKind = 'vehicle' | 'route' | 'station' | 'operator';
export type AlbumSection = 'bus' | 'train' | 'streetcar' | 'special';

export interface Ride {
  id: string;
  vehicleId?: string;
  routeNumber: string;
  routeName: string;
  signMessage: string;
  mode: TransitMode;
  startStopId: string;
  startStopName: string;
  destStopId: string;
  destStopName: string;
  checkedInAt: number;
  lat?: number;
  lng?: number;
  source: RideSource;
}

export interface OwnedCard {
  cardId: string;
  count: number;
  firstUnlockedAt: number;
  fromRideId: string;
}

export interface CardReceipt {
  id: string;
  cardId: string;
  rideId: string;
  receivedAt: number;
}

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  type: CardKind;
  flavor: string;
  color: string;
  /** Emoji placeholder until real art lands. */
  art: string;
  /** Optional image path; takes over the art square when set. */
  artSrc?: string;
  unlockBias?: TransitMode;
}

export interface Vehicle {
  vehicleId: string;
  routeNumber: string;
  routeName: string;
  signMessage: string;
  mode: TransitMode;
  lat: number;
  lng: number;
  delaySeconds?: number;
  bearing?: number;
  distanceMeters?: number;
  inService: boolean;
}

export interface GpsSample extends GeoPoint {
  at: number;
}

export interface OnboardGuess {
  vehicle: Vehicle;
  hits: number;
  distanceMeters: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function rideTripKey(
  ride: Pick<Ride, 'startStopId' | 'routeNumber' | 'destStopId' | 'vehicleId' | 'source'>,
): string {
  if (ride.source === 'onboard') return `onboard|${ride.routeNumber}`;
  if (ride.startStopId && ride.destStopId) {
    return `${ride.startStopId}|${ride.routeNumber}|${ride.destStopId}`;
  }
  return ride.vehicleId ?? ride.routeNumber;
}
