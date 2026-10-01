import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ConfirmDebug } from '../components/ConfirmDebug';
import { LinePicker } from '../components/LinePicker';
import { PackReveal } from '../components/PackReveal';
import { RideHub } from '../components/RideHub';
import { StartMenu } from '../components/StartMenu';
import { createFanfareContext } from '../lib/fanfare';
import {
  haversineMeters,
  parseSimQuery,
  pointAlongPath,
  SIM_TICK_MS,
} from '../lib/geo';
import { sampleConfirm, type ConfirmSample } from '../lib/confirmRide';
import { guessOnboardLines } from '../lib/onboard';
import { cardById, completeCheckIn, newRideId, previewPackCards } from '../lib/packs';
import { cooldownRemaining, listRecentReceipts } from '../lib/storage';
import {
  companionVehiclesAt,
  fetchVehicles,
  riderRouteLabel,
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

const PICKER_REFRESH_MS = 6_000;
const CONFIRM_POLL_MS = 3_000;
const LEAVE_MS = 520;
const PACK_DELAY_MS = 0;
const HOP_VALID_HOLD_MS = 1_150;
const HOP_PURGE_MS = 1_700;
const THEME_START = '#0b0f0c';
const THEME_PLAY = '#084c8d';

function useHopClock(running: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return now;
}

function clearTimer(id: number) {
  window.clearTimeout(id);
}

export function HomePage() {
  const [startPurged, setStartPurged] = useState(false);
  const hopClock = useHopClock(!startPurged);
  const hopDate = hopClock.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
  const hopTime = hopClock.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const location = useLocation();
  const onHome = location.pathname === '/';
  const homeSearchRef = useRef(location.search);
  if (onHome) homeSearchRef.current = location.search;
  const simKey = onHome ? location.search : homeSearchRef.current;
  const sim = useMemo(() => parseSimQuery(simKey), [simKey]);
  const previewPack = new URLSearchParams(simKey).get('pack') === 'preview';
  const liveConfirmHud = Boolean(sim) || new URLSearchParams(simKey).get('hud') === '1';
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
  const [playOpen, setPlayOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [scanId, setScanId] = useState(0);
  const [recentCards, setRecentCards] = useState<{ key: string; card: CardDef }[]>([]);
  const [hopValid, setHopValid] = useState(false);
  const [validUntil, setValidUntil] = useState<string | null>(null);
  const hopReaderRef = useRef<HTMLDivElement>(null);
  const hopScreenRef = useRef<HTMLDivElement>(null);
  const hopOpenTimer = useRef(0);
  const hopPurgeTimer = useRef(0);
  const [pack, setPack] = useState<CardDef[] | null>(null);
  const [awaitingPack, setAwaitingPack] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    vehicleId: string;
    routeNumber: string;
    vehicleStart: GeoPoint;
    riderStart: GeoPoint;
    pickM: number;
    draft: Omit<Ride, 'id' | 'checkedInAt'>;
  } | null>(null);
  const [confirmReady, setConfirmReady] = useState(false);
  const [confirmSample, setConfirmSample] = useState<ConfirmSample | null>(null);
  const traveledRef = useRef(0);
  const dismissedRoutes = useRef(new Set<string>());
  const fanfareRef = useRef<AudioContext | null>(null);
  const packTimers = useRef<number[]>([]);
  const awardingRef = useRef(false);
  const pendingRef = useRef(pendingConfirm);
  pendingRef.current = pendingConfirm;
  const lastVehicleRef = useRef<GeoPoint | null>(null);
  const considerAwardRef = useRef<() => void>(() => {});

  const transitLive = polling && (onboardOpen || Boolean(pendingConfirm));
  const hasFix = origin !== null;

  useEffect(() => {
    if (!playOpen) return;
    void listRecentReceipts(5).then((receipts) => {
      setRecentCards(
        receipts.flatMap((receipt) => {
          const card = cardById(receipt.cardId);
          return card ? [{ key: receipt.id, card }] : [];
        }),
      );
    });
  }, [playOpen, pack]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    meta.setAttribute('content', playOpen ? THEME_PLAY : THEME_START);
  }, [playOpen]);

  useEffect(() => {
    setOnboardGuesses([]);
    setSamples([]);
    setPendingConfirm(null);
    setConfirmReady(false);
    setConfirmSample(null);
    lastVehicleRef.current = null;
    setPack(null);
    setAwaitingPack(false);
    setNotice(null);
    setOnboardOpen(false);
    setScanId(0);
    awardingRef.current = false;
    packTimers.current.forEach((t) => window.clearTimeout(t));
    packTimers.current = [];
    dismissedRoutes.current = new Set();
    traveledRef.current = 0;
    if (sim) {
      setOrigin(sim.start);
      setSamples([{ ...sim.start, at: Date.now() }]);
    }
    if (sim?.autoConfirm) {
      if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
      setPlayOpen(true);
      setStartPurged(true);
      setHopValid(true);
      const vehicle = companionVehiclesAt(sim.start, sim.start, sim.routes)[0];
      if (vehicle) {
        const riderStart = sim.start;
        const vehicleStart = { lat: vehicle.lat, lng: vehicle.lng };
        lastVehicleRef.current = vehicleStart;
        const pickM = haversineMeters(riderStart, vehicleStart);
        const next = {
          vehicleId: vehicle.vehicleId,
          routeNumber: vehicle.routeNumber,
          vehicleStart,
          riderStart,
          pickM,
          draft: {
            vehicleId: vehicle.vehicleId,
            routeNumber: vehicle.routeNumber,
            routeName: vehicle.routeName,
            signMessage: vehicle.signMessage,
            mode: vehicle.mode,
            startStopId: `onboard-${vehicle.routeNumber}`,
            startStopName: 'On board',
            destStopId: `headsign-${vehicle.vehicleId}`,
            destStopName: vehicle.signMessage || 'In service',
            lat: riderStart.lat,
            lng: riderStart.lng,
            source: 'onboard' as const,
          },
        };
        setPendingConfirm(next);
        setConfirmSample(
          sampleConfirm({
            pickM,
            riderStart,
            vehicleStart,
            riderNow: riderStart,
            vehicleNow: vehicleStart,
          }),
        );
      }
    }
  }, [sim]);

  useEffect(() => {
    if (!previewPack) return;
    if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
    setPack(previewPackCards());
  }, [previewPack]);

  useEffect(() => {
    return () => {
      packTimers.current.forEach((t) => window.clearTimeout(t));
      clearTimer(hopOpenTimer.current);
      clearTimer(hopPurgeTimer.current);
    };
  }, []);

  useEffect(() => {
    function onVisibility() {
      setPageVisible(document.visibilityState === 'visible');
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!transitLive) return;
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
        setSamples((prev) => {
          const next = [...prev.slice(-12), { ...gps, at }];
          samplesRef.current = next;
          return next;
        });
        originRef.current = gps;
        if (sim.routes.length) setVehicles(companionVehiclesAt(vehicleAt, gps, sim.routes));
        lastVehicleRef.current = vehicleAt;
        considerAwardRef.current();
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
        const at = Date.now();
        setOrigin(point);
        setSamples((prev) => {
          const next = [...prev.slice(-12), { ...point, at }];
          samplesRef.current = next;
          return next;
        });
        originRef.current = point;
        considerAwardRef.current();
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );

    return () => navigator.geolocation.clearWatch(watch);
  }, [sim, transitLive]);

  const originRef = useRef<GeoPoint | null>(origin);
  originRef.current = origin;
  const samplesRef = useRef(samples);
  samplesRef.current = samples;
  const vehiclesRef = useRef(vehicles);
  vehiclesRef.current = vehicles;

  useEffect(() => {
    let cancelled = false;

    function applyPicker(list: Vehicle[]) {
      setOnboardGuesses(
        guessOnboardLines(samplesRef.current, list).filter(
          (g) => !dismissedRoutes.current.has(g.vehicle.routeNumber),
        ),
      );
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
      lastVehicleRef.current = { lat: v.lat, lng: v.lng };
      considerAwardRef.current();
    }

    if (!transitLive) return;

    void loadVehicles();
    const id = window.setInterval(() => {
      void loadVehicles();
    }, pendingConfirm ? CONFIRM_POLL_MS : PICKER_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sim, pendingConfirm, transitLive, scanId, hasFix]);

  async function confirmTrip(routeNumber: string, next: Omit<Ride, 'id' | 'checkedInAt'>) {
    if (pack || awaitingPack) return;
    setBusy(true);
    setNotice(null);
    try {
      const ride: Ride = { ...next, id: newRideId(), checkedInAt: Date.now() };
      const wait = await cooldownRemaining(rideTripKey(ride));
      if (wait > 0 && !sim?.autoConfirm) {
        setNotice(`Wait ${Math.ceil(wait / 60_000)} min to log this line again`);
        awardingRef.current = false;
        return;
      }
      const cards = await completeCheckIn(ride);
      dismissedRoutes.current.add(routeNumber);
      setOnboardGuesses([]);
      setOnboardOpen(false);
      setAwaitingPack(true);
      packTimers.current.forEach((t) => window.clearTimeout(t));
      packTimers.current = [
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

  considerAwardRef.current = () => {
    const pending = pendingRef.current;
    if (!pending || awardingRef.current) return;
    const vehicleAt = lastVehicleRef.current;
    if (!vehicleAt) return;
    const here = samplesRef.current.at(-1) ?? originRef.current;
    if (!here) return;
    const sample = sampleConfirm({
      pickM: pending.pickM,
      riderStart: pending.riderStart,
      vehicleStart: pending.vehicleStart,
      riderNow: here,
      vehicleNow: vehicleAt,
    });
    setConfirmSample(sample);
    if (sample.b && sample.c) setConfirmReady(true);
    if (!sample.pass) return;
    awardingRef.current = true;
    pendingRef.current = null;
    setPendingConfirm(null);
    void confirmTrip(pending.routeNumber, { ...pending.draft, lat: here.lat, lng: here.lng });
  };

  function confirmOnboard(guess: OnboardGuess) {
    if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
    if (pendingConfirm || busy || awaitingPack || pack) return;
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
      setConfirmReady(false);
      lastVehicleRef.current = { lat: v.lat, lng: v.lng };
      const riderStart = samplesRef.current.at(-1) ?? originRef.current;
      if (!riderStart) {
        setNotice('Need a location fix to check in');
        return;
      }
      const vehicleStart = { lat: v.lat, lng: v.lng };
      const pickM = haversineMeters(riderStart, vehicleStart);
      setPendingConfirm({
        vehicleId: v.vehicleId,
        routeNumber: v.routeNumber,
        vehicleStart,
        riderStart,
        pickM,
        draft,
      });
      setConfirmSample(
        sampleConfirm({
          pickM,
          riderStart,
          vehicleStart,
          riderNow: riderStart,
          vehicleNow: vehicleStart,
        }),
      );
    })();
  }

  function primePlay() {
    if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
    if (playOpen || hopValid) return;
    const until = new Date(Date.now() + 2 * 60 * 60 * 1000);
    setValidUntil(
      until.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    );
    setHopValid(true);
    clearTimer(hopOpenTimer.current);
    hopOpenTimer.current = window.setTimeout(() => {
      const reader = hopReaderRef.current;
      const screen = hopScreenRef.current;
      if (reader && screen) {
        const readerBox = reader.getBoundingClientRect();
        const screenBox = screen.getBoundingClientRect();
        const targetH = readerBox.height * (7 / 8);
        const targetTop = readerBox.top + (readerBox.height - targetH) / 2;
        screen.style.setProperty('--hop-h', `${targetH}px`);
        screen.style.setProperty('--hop-dy', `${targetTop - screenBox.top}px`);
      }
      setPlayOpen(true);
      clearTimer(hopPurgeTimer.current);
      hopPurgeTimer.current = window.setTimeout(() => {
        setStartPurged(true);
      }, HOP_PURGE_MS);
    }, HOP_VALID_HOLD_MS);
  }

  return (
    <section className={`page page-home${playOpen ? ' play-session' : ''}`}>
      {notice ? <p className="banner">{notice}</p> : null}

      {playOpen ? (
        <div className="play-field">
          {onboardOpen ? (
            <LinePicker
              guesses={onboardGuesses}
              locked={busy || awaitingPack || Boolean(pendingConfirm)}
              onPick={confirmOnboard}
              onDone={() => setOnboardOpen(false)}
            />
          ) : (
            <RideHub
              cards={recentCards}
              onBoard={() => {
                if (awaitingPack || pack || pendingConfirm) return;
                if (!fanfareRef.current) fanfareRef.current = createFanfareContext();
                setOnboardGuesses([]);
                setScanId((n) => n + 1);
                setOnboardOpen(true);
              }}
            />
          )}
        </div>
      ) : null}

      {startPurged ? null : (
        <StartMenu
          readerRef={hopReaderRef}
          screenRef={hopScreenRef}
          valid={hopValid}
          open={playOpen}
          validUntil={validUntil}
          date={hopDate}
          time={hopTime}
          onPlay={primePlay}
        />
      )}

      {pendingConfirm ? (
        <div className="confirm-overlay">
          <div className="confirm">
            <p>
              Stay on the {riderRouteLabel(pendingConfirm.draft.mode, pendingConfirm.routeNumber)} to
              get a pack!
            </p>
            <div className="confirm-wait" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="confirm-status">
              {confirmReady ? 'Matching your location…' : 'Keep riding…'}
            </p>
            {liveConfirmHud && confirmSample ? (
              <ConfirmDebug sample={confirmSample} retrying={!confirmSample.pass} />
            ) : null}
            <div className="row-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  pendingRef.current = null;
                  awardingRef.current = false;
                  traveledRef.current = 0;
                  lastVehicleRef.current = null;
                  setPendingConfirm(null);
                  setConfirmReady(false);
                  setConfirmSample(null);
                }}
              >
                Cancel
              </button>
            </div>
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
            setOnboardOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
