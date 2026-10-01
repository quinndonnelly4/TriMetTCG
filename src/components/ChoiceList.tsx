import type { ReactNode } from 'react';

export function ChoiceList<T>({
  items,
  emptyText,
  itemKey,
  onPick,
  locked,
  children,
}: {
  items: T[];
  emptyText: string;
  itemKey: (item: T) => string;
  onPick: (item: T) => void;
  locked?: boolean;
  children: (item: T) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <ul className="vehicle-list">
      {items.map((item) => (
        <li key={itemKey(item)}>
          <button type="button" className="vehicle-row" disabled={locked} onClick={() => onPick(item)}>
            {children(item)}
          </button>
        </li>
      ))}
    </ul>
  );
}
