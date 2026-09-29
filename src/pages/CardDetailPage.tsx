import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CardTile } from '../components/CardTile';
import { cardById } from '../lib/packs';
import { getInventory } from '../lib/storage';

export function CardDetailPage() {
  const { id } = useParams();
  const card = id ? cardById(id) : undefined;
  const [count, setCount] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState<number | null>(null);

  useEffect(() => {
    void getInventory().then((inv) => {
      const row = inv.find((c) => c.cardId === id);
      setCount(row?.count ?? 0);
      setUnlocked(row?.firstUnlockedAt ?? null);
    });
  }, [id]);

  if (!card) {
    return (
      <section className="page">
        <p>Unknown card.</p>
        <Link to="/collection">Album</Link>
      </section>
    );
  }

  if (count === null) {
    return (
      <section className="page">
        <p className="muted">Loading…</p>
      </section>
    );
  }

  if (count === 0) {
    return (
      <section className="page">
        <p>Not unlocked.</p>
        <Link to="/collection">Album</Link>
      </section>
    );
  }

  return (
    <section className="page">
      <Link to="/collection" className="back">
        ← Album
      </Link>
      <div className="card-sleeve">
        <CardTile card={card} count={count} large />
      </div>
      {unlocked ? <p className="muted">First {new Date(unlocked).toLocaleDateString()}</p> : null}
    </section>
  );
}
