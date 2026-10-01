import { ChoiceList } from './ChoiceList';
import { formatDistance } from '../lib/geo';
import { formatHeadsign, modeLabel, riderRouteLabel, routeBadgeClass } from '../lib/trimet';
import type { OnboardGuess } from '../types';

export function LinePicker({
  guesses,
  locked,
  onPick,
  onDone,
}: {
  guesses: OnboardGuess[];
  locked?: boolean;
  onPick: (guess: OnboardGuess) => void;
  onDone: () => void;
}) {
  return (
    <div className="play-picker">
      <div className="play-search-block">
        <p className="play-search">Searching for transit...</p>
        <div className="play-search-scan" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      {guesses.length > 0 ? (
        <ChoiceList
          items={guesses}
          emptyText=""
          itemKey={(g) => g.vehicle.routeNumber}
          onPick={onPick}
          locked={locked}
        >
          {(g) => (
            <>
              <span className={routeBadgeClass(g.vehicle.mode, g.vehicle.routeNumber, g.vehicle.routeName)}>
                {riderRouteLabel(g.vehicle.mode, g.vehicle.routeNumber)}
              </span>
              <span className="vehicle-meta">
                <strong>{g.vehicle.routeName}</strong>
                <span>
                  {formatHeadsign(g.vehicle.signMessage, g.vehicle.routeName) || modeLabel(g.vehicle.mode)}
                </span>
              </span>
              <span className="vehicle-extra">{formatDistance(g.distanceMeters)}</span>
            </>
          )}
        </ChoiceList>
      ) : null}
      <button type="button" className="ghost play-done" onClick={onDone}>
        Done
      </button>
    </div>
  );
}
