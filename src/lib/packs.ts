import catalog from '../data/cards.json';
import type { AlbumSection, CardDef, TransitMode } from '../types';
import { packWeightForRide } from './trimet';
import { addCardsToInventory, recordReceipts, saveRide } from './storage';
import type { Ride } from '../types';

const cards = catalog as CardDef[];

export function allCards(): CardDef[] {
  return cards;
}

export const ALBUM_SECTION_ORDER: AlbumSection[] = ['bus', 'train', 'streetcar', 'special'];

export const albumSectionLabel: Record<AlbumSection, string> = {
  bus: 'Bus',
  train: 'Train',
  streetcar: 'Streetcar',
  special: 'Special',
};

export function albumSection(card: CardDef): AlbumSection {
  if (card.unlockBias === 'bus') return 'bus';
  if (card.unlockBias === 'max' || card.unlockBias === 'wes') return 'train';
  if (card.unlockBias === 'streetcar') return 'streetcar';
  return 'special';
}

export function cardById(id: string): CardDef | undefined {
  return cards.find((c) => c.id === id);
}

function pickWeighted(mode: TransitMode): CardDef {
  const weights = cards.map((c) => packWeightForRide(c, mode));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < cards.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cards[i];
  }
  return cards[cards.length - 1];
}

export function drawPack(mode: TransitMode): CardDef[] {
  const size = 1 + Math.floor(Math.random() * 3);
  return Array.from({ length: size }, () => pickWeighted(mode));
}

export async function completeCheckIn(ride: Ride): Promise<CardDef[]> {
  const pack = drawPack(ride.mode);
  await saveRide(ride);
  const cardIds = pack.map((c) => c.id);
  await addCardsToInventory(cardIds, ride.id, ride.checkedInAt);
  await recordReceipts(cardIds, ride.id, ride.checkedInAt);
  return pack;
}

export function newRideId(): string {
  return crypto.randomUUID();
}
