import { Link } from 'react-router-dom';
import { CardTile } from './CardTile';
import type { CardDef } from '../types';

export function RideHub({
  cards,
  onBoard,
}: {
  cards: { key: string; card: CardDef }[];
  onBoard: () => void;
}) {
  return (
    <div className="ride-hub">
      <div className="ride-hero">
        <p>Ride transit around Portland to collect cards</p>
        <button type="button" className="primary ride-board" onClick={onBoard}>
          I&apos;m on TriMet
        </button>
      </div>
      <div className="ride-recent">
        <h2>Last received</h2>
        {cards.length === 0 ? (
          <p className="muted">Pulls will show up here</p>
        ) : (
          <div className="ride-recent-grid">
            {cards.map(({ key, card }) => (
              <Link key={key} to={`/card/${card.id}`} draggable={false}>
                <CardTile card={card} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
