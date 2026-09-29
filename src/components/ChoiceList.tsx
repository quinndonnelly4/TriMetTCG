import type { ReactNode } from 'react';

export function ChoiceList<T>({
  items,
  emptyText,
  itemKey,
  onPick,
  leavingKey,
  locked,
  children,
}: {
  items: T[];
  emptyText: string;
  itemKey: (item: T) => string;
  onPick: (item: T) => void;
  leavingKey?: string | null;
  locked?: boolean;
  children: (item: T) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <ul className="vehicle-list">
      {items.map((item) => {
        const key = itemKey(item);
        const leaving = key === leavingKey;
        return (
          <li key={key} className={leaving ? 'leaving' : undefined}>
            <button
              type="button"
              className="vehicle-row"
              disabled={locked || Boolean(leavingKey)}
              onClick={() => onPick(item)}
            >
              {children(item)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
