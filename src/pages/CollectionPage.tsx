import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardTile } from '../components/CardTile';
import { ALBUM_SECTION_ORDER, albumSection, albumSectionLabel, allCards, cardById } from '../lib/packs';
import { getInventory } from '../lib/storage';
import type { CardDef, OwnedCard } from '../types';

export function CollectionPage() {
  const catalog = allCards();
  const [owned, setOwned] = useState<OwnedCard[]>([]);

  useEffect(() => {
    void getInventory().then(setOwned);
  }, []);

  const unlockedCards = useMemo(() => {
    const rows: { card: CardDef; count: number }[] = [];
    for (const item of owned) {
      const card = cardById(item.cardId);
      if (card) rows.push({ card, count: item.count });
    }
    rows.sort((a, b) => {
      const sectionDelta =
        ALBUM_SECTION_ORDER.indexOf(albumSection(a.card)) - ALBUM_SECTION_ORDER.indexOf(albumSection(b.card));
      if (sectionDelta !== 0) return sectionDelta;
      return a.card.name.localeCompare(b.card.name);
    });
    return rows;
  }, [owned]);

  const copies = owned.reduce((s, o) => s + o.count, 0);
  const sections = ALBUM_SECTION_ORDER.map((section) => ({
    section,
    cards: unlockedCards.filter((row) => albumSection(row.card) === section),
  })).filter((group) => group.cards.length > 0);

  return (
    <section className="page page-album">
      <h1 className="page-title">Album</h1>
      <p className="count-chip">
        {owned.length} of {catalog.length} unique · {copies} copies
      </p>
      {unlockedCards.length === 0 ? (
        <p className="muted">You don't have any cards... get on TriMet and go somewhere!</p>
      ) : (
        sections.map(({ section, cards }) => (
          <section key={section} className="album-section">
            <h2>{albumSectionLabel[section]}</h2>
            <div className="card-grid">
              {cards.map(({ card, count }) => (
                <Link key={card.id} to={`/card/${card.id}`} draggable={false}>
                  <CardTile card={card} count={count} />
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}
