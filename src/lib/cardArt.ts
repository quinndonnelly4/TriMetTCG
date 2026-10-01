import type { CardDef } from '../types';

/** Card ids that have a full-face WebP in public/art. */
const PAINTED = new Set(['line-20', 'line-12', 'fx2', 'max-orange', 'wes-car']);

export function paintedArtSrc(card: CardDef): string | undefined {
  if (!PAINTED.has(card.id) || !card.image) return undefined;
  return card.image;
}
