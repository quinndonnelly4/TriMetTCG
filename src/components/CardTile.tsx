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
  locked,
  large,
  onClick,
}: {
  card: CardDef;
  count?: number;
  locked?: boolean;
  large?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`card-tile rarity-${card.rarity}${locked ? ' locked' : ''}${large ? ' card-tile-lg' : ''}`}
      style={{ ['--card-accent' as string]: card.color }}
      draggable={false}
      onClick={onClick}
    >
      <div className="card-tile-face">
        <span className="card-rarity">{rarityLabel[card.rarity]}</span>
        <h3>{locked ? '???' : card.name}</h3>
        <p className="card-type">{locked ? 'Unknown' : albumSectionLabel[albumSection(card)]}</p>
        <div className="card-art">
          {locked ? (
            <span className="card-art-emoji">?</span>
          ) : card.artSrc ? (
            <img className="card-art-img" src={card.artSrc} alt="" />
          ) : (
            <span className="card-art-emoji">{card.art}</span>
          )}
        </div>
        <p className="card-flavor">{locked ? '' : card.flavor}</p>
        {!locked && count != null && count > 1 ? <span className="card-count">×{count}</span> : null}
      </div>
    </Tag>
  );
}
