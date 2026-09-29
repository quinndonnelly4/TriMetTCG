import type { Ride } from '../types';
import { modeLabel, riderRouteLabel, routeBadgeClass } from '../lib/trimet';

export function RideRow({ ride }: { ride: Ride }) {
  const when = new Date(ride.checkedInAt).toLocaleString();
  const start = ride.startStopName || 'Start';
  const dest = ride.destStopName || ride.signMessage || 'End';
  const title =
    ride.source === 'onboard'
      ? `${ride.routeName}${dest ? ` · ${dest}` : ''}`
      : `${start} → ${ride.routeName} → ${dest}`;
  return (
    <div className="ride-row">
      <span className={routeBadgeClass(ride.mode, ride.routeNumber, ride.routeName)}>
        {riderRouteLabel(ride.mode, ride.routeNumber)}
      </span>
      <div>
        <strong>{title}</strong>
        <p className="muted">
          {modeLabel(ride.mode)} · {when}
        </p>
      </div>
    </div>
  );
}
