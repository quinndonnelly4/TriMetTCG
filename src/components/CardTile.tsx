import { useEffect, useState } from 'react';
import { paintedArtSrc } from '../lib/cardArt';
import { albumSection, albumSectionLabel } from '../lib/packs';
import type { CardDef } from '../types';

const rarityLabel: Record<CardDef['rarity'], string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

export function CardTile({
  card,
  count,
  large,
}: {
  card: CardDef;
  count?: number;
  large?: boolean;
}) {
  const fileSrc = paintedArtSrc(card);
  const [artReady, setArtReady] = useState(false);
  const [artFailed, setArtFailed] = useState(false);

  useEffect(() => {
    if (!fileSrc) {
      setArtReady(false);
      setArtFailed(false);
      return;
    }
    let cancelled = false;
    setArtReady(false);
    setArtFailed(false);
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setArtReady(true);
    };
    probe.onerror = () => {
      if (!cancelled) setArtFailed(true);
    };
    probe.src = fileSrc;
    if (probe.complete && probe.naturalWidth > 0) setArtReady(true);
    return () => {
      cancelled = true;
    };
  }, [fileSrc]);

  const faceSrc = fileSrc && !artFailed ? fileSrc : undefined;
  const painted = Boolean(faceSrc && artReady);
  return (
    <div
      className={`card-tile rarity-${card.rarity}${large ? ' card-tile-lg' : ''}${faceSrc ? ' card-tile-has-art' : ''}${painted ? ' card-tile-painted' : ''}`}
      style={{ ['--card-accent' as string]: card.color }}
      draggable={false}
    >
      <div className="card-tile-face">
        {faceSrc ? (
          <img
            className="card-face-art"
            src={faceSrc}
            alt={card.name}
            draggable={false}
            onLoad={() => setArtReady(true)}
            onError={() => setArtFailed(true)}
          />
        ) : null}
        {faceSrc ? null : (
          <>
            <span className="card-rarity">{rarityLabel[card.rarity]}</span>
            <h3>{card.name}</h3>
            <p className="card-type">{albumSectionLabel[albumSection(card)]}</p>
            <div className="card-art">
              <span className="card-art-emoji">{card.art}</span>
            </div>
            <p className="card-flavor">{card.flavor}</p>
          </>
        )}
        {count != null && count > 1 ? <span className="card-count">×{count}</span> : null}
      </div>
    </div>
  );
}
