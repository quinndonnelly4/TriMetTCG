import { useEffect, useMemo, useState } from 'react';
import { DebugPanel } from '../components/DebugPanel';
import { routeCompendium } from '../lib/compendium';
import { listRides } from '../lib/storage';
import type { Ride } from '../types';

export function LogPage() {
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    void listRides().then(setRides);
  }, []);

  const rows = useMemo(() => routeCompendium(rides), [rides]);

  return (
    <section className="page">
      <h1 className="page-title">Log</h1>
      <div className="compendium">
        {rows.map((row) => (
          <p key={row.mode} className="compendium-row">
            <span>{row.title}</span>
            <span>
              {row.ridden}/{row.total}
            </span>
          </p>
        ))}
      </div>
      <DebugPanel />
    </section>
  );
}
