import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChoiceList } from '../components/ChoiceList';
import { PackReveal } from '../components/PackReveal';
import { createFanfareContext } from '../lib/fanfare';
import {
  debugMode,
  formatDistance,
  haversineMeters,
  parseSimQuery,
  pointAlongPath,
  RIDE_CONFIRM_MOVE_M,
  RIDE_CONFIRM_RADIUS_M,
  SIM_TICK_MS,
} from '../lib/geo';
import { guessOnboardLines } from '../lib/onboard';
import { allCards, completeCheckIn, newRideId } from '../lib/packs';
import { cooldownRemaining, resetApp } from '../lib/storage';
import {
  companionVehiclesAt,
  fetchVehicles,
  formatHeadsign,
  modeLabel,
  riderRouteLabel,
  routeBadgeClass,
} from '../lib/trimet';
import {
  rideTripKey,
  type CardDef,
  type GeoPoint,
  type GpsSample,
  type OnboardGuess,
  type Ride,
  type Vehicle,
} from '../types';

const TRANSIT_HINT_MS = 10_000;
const PICKER_REFRESH_MS = 6_000;
const CONFIRM_POLL_MS = 3_000;
const LEAVE_MS = 520;
const PACK_DELAY_MS = 0;

export function HomePage() {
  const location = useLocation();
  const onHome = location.pathname === '/';
  const homeSearchRef = useRef(location.search);
  if (onHome) homeSearchRef.current = location.search;
  const simKey = onHome ? location.search : homeSearchRef.current;
  const sim = useMemo(() => parseSimQuery(simKey), [simKey]);
  const showDebug = debugMode(homeSearchRef.current);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState === 'visible',
  );
  const polling = onHome && pageVisible;

  const [origin, setOrigin] = useState<GeoPoint | null>(sim?.start ?? null);
  const [samples, setSamples] = useState<GpsSample[]>(() =>
    sim ? [{ ...sim.start, at: Date.now() }] : [],
  );
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [onboardGuesses, setOnboardGuesses] = useState<OnboardGuess[]>([]);
  const [showTransitHint, setShowTransitHint] = useState(false);
  const [leavingRoute, setLeavingRoute] = useState<string | null>(null);
  const [pack, setPack] = useState<CardDef[] | null>(null);
  const [awaitingPack, setAwaitingPack] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    vehicleId: string;
    routeNumber: string;
    vehicleStart: GeoPoint;
    draft: Omit<Ride, 'id' | 'checkedInAt'>;
  } | null>(null);
  const [vehicleMovedM, setVehicleMovedM] = useState(0);
  const traveledRef = useRef(0);
  const dismissedRoutes = useRef(new Set<string>());
  const fanfareRef = useRef<AudioContext | null>(null);
  const packTimers = useRef<number[]>([]);
  const awardingRef = useRef(false);
  const pendingRef = useRef(pendingConfirm);
  pendingRef.current = pendingConfirm;

  useEffect(() => {
    setOnboardGuesses([]);
    setSamples([]);
    setShowTransitHint(false);
    setLeavingRoute(null);
    setPendingConfirm(null);
    setVehicleMovedM(0);
    setPack(null);
    setAwaitingPack(false);
    setNotice(null);
    awardingRef.current = false;
    packTimers.current.forEach((t) => window.clearTimeout(t));
    packTimers.current = [];
    dismissedRoutes.current = new Set();
    traveledRef.current = 0;
    if (sim) {
      setOrigin(sim.start);
      setSamples([{ ...sim.start, at: Date.now() }]);
    }
  }, [sim]);

  useEffect(() => {
    return () => packTimers.current.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    function onVisibility() {
      setPageVisible(document.visibilityState === 'visible');
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!polling) return;
    if (sim && sim.speedMps > 0) {
      const tick = window.setInterval(() => {
        if (!pendingRef.current) {
          const gps = sim.start;
          const at = Date.now();
          setOrigin(gps);
          setSamples((prev) => (prev.length ? prev : [{ ...gps, at }]));
          if (sim.routes.length) setVehicles(companionVehiclesAt(gps, gps, sim.routes));
          return;
        }
        traveledRef.current += sim.speedMps * (SIM_TICK_MS / 1000);
        const vehicleAt = pointAlongPath(sim.path, traveledRef.current, sim.loop);
        const gps = sim.gpsFollowsVehicle ? vehicleAt : sim.start;
        const at = Date.now();
        setOrigin(gps);
        setSamples((prev) => [...prev.slice(-12), { ...gps, at }]);
        if (sim.routes.length) setVehicles(companionVehiclesAt(vehicleAt, gps, sim.routes));
        setVehicleMovedM(haversineMeters(pendingRef.current.vehicleStart, vehicleAt));
      }, SIM_TICK_MS);
      return () => window.clearInterval(tick);
    }

    if (sim) {
      setOrigin(sim.start);
      setSamples([{ ...sim.start, at: Date.now() }]);
      return;
    }

    if (!navigator.geolocation) return;

    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setOrigin(point);
        setSamples((prev) => [...prev.slice(-12), { ...point, at: Date.now() }]);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
  }, [sim, polling]);

  const originRef = useRef<GeoPoint | null>(origin);
  originRef.current = origin;
  const samplesRef = useRef(samples);
  samplesRef.current = samples;
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;
  const leavingRouteRef = useRef(leavingRoute);
  leavingRouteRef.current = leavingRoute;

  useEffect(() => {
    let cancelled = false;

    function applyPicker(list: Vehicle[]) {
      const fresh = guessOnboardLines(samplesRef.current, list).filter((g) => {
        const route = g.vehicle.routeNumber;
        if (route === leavingRouteRef.current) return true;
        return !dismissedRoutes.current.has(route);
      });
      setOnboardGuesses((prev) => {
        const leaving = leavingRouteRef.current;
        if (!leaving) return fresh;
        const still = fresh.some((g) => g.vehicle.routeNumber === leaving);
        if (still) return fresh;
        const keep = prev.find((g) => g.vehicle.routeNumber === leaving);
        return keep ? [...fresh, keep] : fresh;
      });
    }

    async function loadVehicles() {
      const here = originRef.current;
      if (!here) return;
      if (sim?.routes.length) {
        const vehicleAt = sim.gpsFollowsVehicle
          ? here
          : pointAlongPath(sim.path, traveledRef.current, sim.loop);
        const list = companionVehiclesAt(vehicleAt, here, sim.routes);
        if (!cancelled) {
          setVehicles(list);
          applyPicker(list);
          maybeFinishRide(list);
        }
        return;
      }
      try {
        const list = await fetchVehicles(here);
        if (!cancelled) {
          setVehicles(list);
          applyPicker(list);
          maybeFinishRide(list);
        }
      } catch {
        if (!cancelled) applyPicker(vehiclesRef.current);
      }
    }

    function maybeFinishRide(list: Vehicle[]) {
      const pending = pendingRef.current;
      if (!pending || awardingRef.current) return;
      const v = list.find((x) => x.vehicleId === pending.vehicleId);
      if (!v) return;
      const moved = haversineMeters(pending.vehicleStart, { lat: v.lat, lng: v.lng });
      setVehicleMovedM(moved);
      if (moved < RIDE_CONFIRM_MOVE_M) return;
      const here = samplesRef.current.at(-1) ?? originRef.current;
      if (!here) return;
      const d = haversineMeters(here, { lat: v.lat, lng: v.lng });
      awardingRef.current = true;
      pendingRef.current = null;
      setPendingConfirm(null);
      if (d <= RIDE_CONFIRM_RADIUS_M) {
        void confirmTrip(pending.routeNumber, { ...pending.draft, lat: here.lat, lng: here.lng });
      } else {
        awardingRef.current = false;
        setNotice('Not close enough after it moved');
      }
    }

    if (!polling) return;

    void loadVehicles();
    const id = window.setInterval(() => {
      void loadVehicles();
    }, pendingConfirm ? CONFIRM_POLL_MS : PICKER_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sim, pendingConfirm, polling]);

  useEffect(() => {
    if (onboardGuesses.length > 0) {
      setShowTransitHint(false);
      return;
    }
    setShowTransitHint(false);
    const t = window.setTimeout(() => setShowTransitHint(true), TRANSIT_HINT_MS);
    return () => window.clearTimeout(t);
  }, [onboardGuesses.length, sim]);

  async function confirmTrip(routeNumber: string, next: Omit<Ride, 'id' | 'checkedInAt'>) {
    if (pack || leavingRoute || awaitingPack) return;
    setBusy(true);
    setNotice(null);
    try {
      const ride: Ride = { ...next, id: newRideId(), checkedInAt: Date.now() };
      const wait = await cooldownRemaining(rideTripKey(ride));
      if (wait > 0) {
        setNotice(`Wait ${Math.ceil(wait / 60_000)} min to log this line again`);
        awardingRef.current = false;
        return;
      }
      const cards = await completeCheckIn(ride);
      dismissedRoutes.current.add(routeNumber);
      setLeavingRoute(routeNumber);
      setAwaitingPack(true);
      packTimers.current.forEach((t) => window.clearTimeout(t));
      packTimers.current = [
        window.setTimeout(() => {
          setOnboardGuesses((prev) => prev.filter((g) => g.vehicle.routeNumber !== routeNumber));
          setLeavingRoute(null);
        }, LEAVE_MS),
        window.setTimeout(() => {
          setPack(cards);
          setAwaitingPack(false);
        }, LEAVE_MS + PACK_DELAY_MS),
      ];
    } finally {
      setBusy(false);
      awardingRef.current = false;
    }
  }

  function confirmOnboard(guess: OnboardGuess) {
    if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
    if (pendingConfirm || busy || leavingRoute || awaitingPack || pack) return;
    const v = guess.vehicle;
    const draft: Omit<Ride, 'id' | 'checkedInAt'> = {
      vehicleId: v.vehicleId,
      routeNumber: v.routeNumber,
      routeName: v.routeName,
      signMessage: v.signMessage,
      mode: v.mode,
      startStopId: `onboard-${v.routeNumber}`,
      startStopName: 'On board',
      destStopId: `headsign-${v.vehicleId}`,
      destStopName: v.signMessage || 'In service',
      lat: origin?.lat,
      lng: origin?.lng,
      source: 'onboard',
    };
    void (async () => {
      const wait = await cooldownRemaining(rideTripKey(draft));
      if (wait > 0) {
        setNotice(`Wait ${Math.ceil(wait / 60_000)} min to log this line again`);
        return;
      }
      setNotice(null);
      setVehicleMovedM(0);
      setPendingConfirm({
        vehicleId: v.vehicleId,
        routeNumber: v.routeNumber,
        vehicleStart: { lat: v.lat, lng: v.lng },
        draft,
      });
    })();
  }

  const searching = onboardGuesses.length === 0 && !awaitingPack && !pack && !pendingConfirm;

  return (
    <section className="page">
      {notice ? <p className="banner">{notice}</p> : null}

      {searching ? (
        <div className="search-status">
          <div className="search-radar" aria-hidden="true">
            <span className="radar-ring" />
            <span className="radar-ring" />
            <span className="radar-ring" />
            <span className="radar-core" />
          </div>
          <p>Looking for the line you're on…</p>
          {showTransitHint ? (
            <p className="muted">You must be on a moving bus, MAX, or streetcar to get cards.</p>
          ) : null}
        </div>
      ) : onboardGuesses.length > 0 ? (
        <>
          <h2 className="page-title">Which line?</h2>
          <ChoiceList
            items={onboardGuesses}
            emptyText=""
            itemKey={(g) => g.vehicle.routeNumber}
            onPick={confirmOnboard}
            leavingKey={leavingRoute}
            locked={busy || awaitingPack || Boolean(pendingConfirm)}
          >
            {(g) => (
              <>
                <span className={routeBadgeClass(g.vehicle.mode, g.vehicle.routeNumber, g.vehicle.routeName)}>
                  {riderRouteLabel(g.vehicle.mode, g.vehicle.routeNumber)}
                </span>
                <span className="vehicle-meta">
                  <strong>{g.vehicle.routeName}</strong>
                  <span>
                    {formatHeadsign(g.vehicle.signMessage, g.vehicle.routeName) ||
                      modeLabel(g.vehicle.mode)}
                  </span>
                </span>
                <span className="vehicle-extra">{formatDistance(g.distanceMeters)}</span>
              </>
            )}
          </ChoiceList>
        </>
      ) : null}

      {pendingConfirm ? (
        <div className="confirm-overlay">
          <div className="confirm">
            <p>
              Stay on the {riderRouteLabel(pendingConfirm.draft.mode, pendingConfirm.routeNumber)} to
              receive cards
            </p>
            <progress
              className="ride-progress"
              max={RIDE_CONFIRM_MOVE_M}
              value={Math.min(vehicleMovedM, RIDE_CONFIRM_MOVE_M)}
            />
            <div className="row-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  pendingRef.current = null;
                  awardingRef.current = false;
                  traveledRef.current = 0;
                  setPendingConfirm(null);
                  setVehicleMovedM(0);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDebug ? (
        <div className="debug-panel">
          <h2>Debug</h2>
          <div className="debug-links">
            <Link className="secondary" to="/?sim=ride-ok">
              125 m pass
            </Link>
            <Link className="secondary" to="/?sim=ride-miss">
              125 m fail
            </Link>
            <Link className="ghost" to="/?sim=max-all">
              All MAX
            </Link>
            <Link className="ghost" to="/?sim=downtown">
              Pioneer
            </Link>
            <Link className="ghost" to="/">
              Clear
            </Link>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
                setPack(allCards().slice(0, 3));
              }}
            >
              Preview pack
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void (async () => {
                  if (!window.confirm('Reset album, log, and cooldowns?')) return;
                  await resetApp();
                  window.location.reload();
                })();
              }}
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}

      {pack ? (
        <PackReveal
          cards={pack}
          audio={fanfareRef.current}
          onDone={() => {
            setPack(null);
            setAwaitingPack(false);
          }}
        />
      ) : null}
    </section>
  );
}
