import { useEffect, useState } from 'react';
import { RideRow } from '../components/RideRow';
import { listRides } from '../lib/storage';
import type { Ride } from '../types';

export function LogPage() {
  const [rides, setRides] = useState<Ride[]>([]);

  useEffect(() => {
    void listRides().then(setRides);
  }, []);

  return (
    <section className="page">
      <h1 className="page-title">Log</h1>
      {rides.length === 0 ? <p className="muted">No rides yet</p> : null}
      <div className="log-list">
        {rides.map((ride) => (
          <RideRow key={ride.id} ride={ride} />
        ))}
      </div>
    </section>
  );
}
