import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { rideTripKey, type CardReceipt, type OwnedCard, type Ride } from '../types';
import { COOLDOWN_MS } from './geo';

const DB_NAME = 'trimet-tcg';
const VERSION = 2;

interface TcgDb extends DBSchema {
  rides: {
    key: string;
    value: Ride;
  };
  inventory: {
    key: string;
    value: OwnedCard;
  };
  receipts: {
    key: string;
    value: CardReceipt;
  };
}

let dbPromise: Promise<IDBPDatabase<TcgDb>> | null = null;

function db(): Promise<IDBPDatabase<TcgDb>> {
  if (!dbPromise) {
    dbPromise = openDB<TcgDb>(DB_NAME, VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains('rides')) {
          database.createObjectStore('rides', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('inventory')) {
          database.createObjectStore('inventory', { keyPath: 'cardId' });
        }
        if (!database.objectStoreNames.contains('receipts')) {
          database.createObjectStore('receipts', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveRide(ride: Ride): Promise<void> {
  await (await db()).put('rides', ride);
}

export async function listRides(): Promise<Ride[]> {
  const all = await (await db()).getAll('rides');
  return all.sort((a, b) => b.checkedInAt - a.checkedInAt);
}

export async function getInventory(): Promise<OwnedCard[]> {
  const all = await (await db()).getAll('inventory');
  return all.sort((a, b) => a.cardId.localeCompare(b.cardId));
}

export async function addCardsToInventory(
  cardIds: string[],
  rideId: string,
  unlockedAt: number,
): Promise<OwnedCard[]> {
  const database = await db();
  const tx = database.transaction('inventory', 'readwrite');
  const results: OwnedCard[] = [];
  for (const cardId of cardIds) {
    const existing = await tx.store.get(cardId);
    const next: OwnedCard = existing
      ? { ...existing, count: existing.count + 1 }
      : { cardId, count: 1, firstUnlockedAt: unlockedAt, fromRideId: rideId };
    await tx.store.put(next);
    results.push(next);
  }
  await tx.done;
  return results;
}

export async function recordReceipts(
  cardIds: string[],
  rideId: string,
  receivedAt: number,
): Promise<void> {
  const database = await db();
  const tx = database.transaction('receipts', 'readwrite');
  for (let i = 0; i < cardIds.length; i++) {
    await tx.store.put({
      id: crypto.randomUUID(),
      cardId: cardIds[i],
      rideId,
      receivedAt: receivedAt + i,
    });
  }
  await tx.done;
}

export async function listRecentReceipts(limit = 5): Promise<CardReceipt[]> {
  const all = await (await db()).getAll('receipts');
  return all.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, limit);
}

export async function cooldownRemaining(tripKey: string, now = Date.now()): Promise<number> {
  const rides = await listRides();
  const last = rides.find((r) => rideTripKey(r) === tripKey);
  if (!last) return 0;
  const elapsed = now - last.checkedInAt;
  return Math.max(0, COOLDOWN_MS - elapsed);
}

export async function resetApp(): Promise<void> {
  const database = await db();
  const tx = database.transaction(['rides', 'inventory', 'receipts'], 'readwrite');
  await tx.objectStore('rides').clear();
  await tx.objectStore('inventory').clear();
  await tx.objectStore('receipts').clear();
  await tx.done;
}
