export type TransitMode = 'bus' | 'max' | 'wes' | 'streetcar';
export type RideSource = 'onboard';
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
  /** Emoji used when no full-face WebP is available. */
  art: string;
  /** Public path for full-face art, e.g. `/art/line-20.webp`. */
  image: string;
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
  distanceMeters?: number;
  inService: boolean;
}

export interface GpsSample extends GeoPoint {
  at: number;
}

export interface OnboardGuess {
  vehicle: Vehicle;
  distanceMeters: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function rideTripKey(ride: Pick<Ride, 'routeNumber'>): string {
  return `onboard|${ride.routeNumber}`;
}
