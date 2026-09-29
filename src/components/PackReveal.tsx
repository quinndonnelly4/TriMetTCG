import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CardDef } from '../types';
import { playFanfare } from '../lib/fanfare';
import {
  cardLightVars,
  cardMoveTransform,
  cardShine,
  followToward,
  makeCardLight,
  type CardLight,
} from '../lib/cardFx';
import { CardTile } from './CardTile';

const COLORS = ['#f5d76e', '#f4a261', '#7dd3fc', '#f9a8d4', '#86efac', '#fff7d6'];
const EXIT_MS = 280;
const REVEAL_MS = 1400;
const EDGE_OF_LENGTH = 0.125;

function burstPieces(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = 90 + Math.random() * 220;
    return {
      i,
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist - 40,
      rot: Math.floor(Math.random() * 720 - 360),
      delay: Math.random() * 0.18,
      duration: 0.85 + Math.random() * 0.55,
      color: COLORS[i % COLORS.length],
      w: 6 + Math.floor(Math.random() * 6),
      h: 10 + Math.floor(Math.random() * 10),
    };
  });
}

type ExitDir = 'left' | 'right' | 'up' | 'down';

function exitClass(dir: ExitDir) {
  return `pack-card-exit-${dir}`;
}

function exitFromDelta(x: number, y: number): ExitDir {
  if (Math.abs(x) >= Math.abs(y)) return x >= 0 ? 'right' : 'left';
  return y >= 0 ? 'down' : 'up';
}

export function PackReveal({
  cards,
  audio,
  onDone,
}: {
  cards: CardDef[];
  audio: AudioContext | null;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [exit, setExit] = useState<ExitDir | null>(null);
  const [arriving, setArriving] = useState(true);
  const [pieces] = useState(() => burstPieces(48));
  const pointer = useRef({ x: 0, y: 0, t: 0, tracking: false });
  const finger = useRef({ x: 0, y: 0 });
  const cardPos = useRef({ x: 0, y: 0 });
  const home = useRef({ x: 0, y: 0 });
  const edgeMargin = useRef(80);
  const followFrame = useRef(0);
  const leaving = useRef(false);
  const arriveTimer = useRef(0);
  const lights = useRef(new Map<string, CardLight>());
  const [, setLightTick] = useState(0);
  const shell = document.querySelector('.app-shell');

  function stopFollow() {
    if (followFrame.current) cancelAnimationFrame(followFrame.current);
    followFrame.current = 0;
  }

  function tickFollow() {
    const next = followToward(cardPos.current, finger.current);
    cardPos.current = next;
    setDrag({
      x: next.x,
      y: next.y,
      active: true,
    });
    if (pointer.current.tracking && !leaving.current) {
      followFrame.current = requestAnimationFrame(tickFollow);
    } else {
      followFrame.current = 0;
    }
  }

  function lightOf(id: string) {
    const existing = lights.current.get(id);
    if (existing) return existing;
    const made = makeCardLight(`${id}-${Math.random()}`);
    lights.current.set(id, made);
    return made;
  }

  function rollLight(id: string) {
    const made = makeCardLight(`${id}-${Math.random()}`);
    lights.current.set(id, made);
    setLightTick((n) => n + 1);
    return made;
  }

  function pulseArrive(cardId?: string) {
    if (cardId) rollLight(cardId);
    setArriving(true);
    if (arriveTimer.current) window.clearTimeout(arriveTimer.current);
    arriveTimer.current = window.setTimeout(() => setArriving(false), REVEAL_MS);
  }

  useEffect(() => {
    playFanfare(audio);
    setIndex(0);
    setDrag({ x: 0, y: 0, active: false });
    setExit(null);
    leaving.current = false;
    finger.current = { x: 0, y: 0 };
    cardPos.current = { x: 0, y: 0 };
    stopFollow();
    lights.current.clear();
    pulseArrive(cards[0]?.id);
    return () => {
      stopFollow();
      if (arriveTimer.current) window.clearTimeout(arriveTimer.current);
    };
  }, [audio, cards]);

  const dismiss = useCallback(
    (dir: ExitDir) => {
      if (leaving.current) return;
      leaving.current = true;
      setExit(dir);
      if (index + 1 < cards.length) pulseArrive(cards[index + 1]?.id);
      window.setTimeout(() => {
        const next = index + 1;
        if (next >= cards.length) {
          onDone();
          return;
        }
        leaving.current = false;
        finger.current = { x: 0, y: 0 };
        cardPos.current = { x: 0, y: 0 };
        setExit(null);
        setDrag({ x: 0, y: 0, active: false });
        setIndex(next);
      }, EXIT_MS);
    },
    [cards.length, index, onDone],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (leaving.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is optional; mouse/touch still report moves on the card */
    }
    const rect = event.currentTarget.getBoundingClientRect();
    home.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    edgeMargin.current = Math.max(rect.width, rect.height) * EDGE_OF_LENGTH;
    pointer.current = { x: event.clientX, y: event.clientY, t: performance.now(), tracking: true };
    cardPos.current = { x: 0, y: 0 };
    finger.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: true });
    stopFollow();
    followFrame.current = requestAnimationFrame(tickFollow);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current.tracking || leaving.current) return;
    if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) return;
    finger.current = {
      x: event.clientX - pointer.current.x,
      y: event.clientY - pointer.current.y,
    };
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current.tracking || leaving.current) return;
    pointer.current.tracking = false;
    stopFollow();
    const x = event.clientX - pointer.current.x;
    const y = event.clientY - pointer.current.y;
    const screen = document.querySelector('.app-shell')?.getBoundingClientRect();
    const cx = home.current.x + cardPos.current.x;
    const cy = home.current.y + cardPos.current.y;
    const m = edgeMargin.current;
    const nearEdge = Boolean(
      screen &&
        (cx < screen.left + m ||
          cx > screen.right - m ||
          cy < screen.top + m ||
          cy > screen.bottom - m),
    );
    if (nearEdge) {
      dismiss(exitFromDelta(x, y));
      return;
    }
    finger.current = { x: 0, y: 0 };
    cardPos.current = { x: 0, y: 0 };
    setDrag({ x: 0, y: 0, active: false });
  }

  const remaining = cards.slice(index, index + 2);
  const moveX = drag.x;
  const moveY = drag.y;
  const dragging = drag.active && !exit;

  const ui = (
    <div className="pack-overlay" role="dialog" aria-label="Cards received" aria-modal="true">
      <div className="confetti-layer" aria-hidden="true">
        {pieces.map((p) => (
          <span
            key={p.i}
            className="confetti-piece"
            style={{
              ['--x' as string]: `${p.x}px`,
              ['--y' as string]: `${p.y}px`,
              ['--rot' as string]: `${p.rot}deg`,
              ['--delay' as string]: `${p.delay}s`,
              ['--dur' as string]: `${p.duration}s`,
              width: p.w,
              height: p.h,
              background: p.color,
            }}
          />
        ))}
      </div>
      <p className="pack-cheer">Nice!</p>
      <div className="pack-stack">
        {remaining
          .map((card, depth) => {
            const top = depth === 0;
            const light = lightOf(card.id);
            const shine = cardShine(light, moveX, moveY, top && dragging);
            const revealing = (!top && exit) || (top && arriving && !exit);
            return (
              <div
                key={`${card.id}-${index + depth}`}
                className={`pack-card card-fx${top && exit ? ` ${exitClass(exit)}` : ''}${revealing ? ' pack-card-revealing card-fx-revealing' : ''}`}
                style={{
                  zIndex: 2 - depth,
                  pointerEvents: top ? 'auto' : 'none',
                  ['--shine-x' as string]: `${shine.x}%`,
                  ['--shine-y' as string]: `${shine.y}%`,
                  ...cardLightVars(light),
                  transform: top && !exit ? cardMoveTransform(moveX, moveY) : undefined,
                  transition: top && dragging ? 'none' : undefined,
                }}
                onPointerDown={top ? onPointerDown : undefined}
                onPointerMove={top ? onPointerMove : undefined}
                onPointerUp={top ? onPointerUp : undefined}
                onPointerCancel={top ? onPointerUp : undefined}
              >
                <CardTile card={card} />
                <div className="card-fx-glare" aria-hidden="true" />
              </div>
            );
          })
          .reverse()}
      </div>
      <p className="pack-hint">Swipe to open the next card</p>
    </div>
  );

  return shell ? createPortal(ui, shell) : ui;
}
