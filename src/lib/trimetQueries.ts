const KEY = 'trimet-query-count';

function readStored(): number {
  try {
    const n = Number(sessionStorage.getItem(KEY) ?? '0');
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

let count = readStored();

export function trimetQueryCount(): number {
  return count;
}

export function recordTrimetQuery(): void {
  count += 1;
  try {
    sessionStorage.setItem(KEY, String(count));
  } catch {
    /* private mode */
  }
}

export function resetTrimetQueryCount(): void {
  count = 0;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
