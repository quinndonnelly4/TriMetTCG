import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CardDef } from '../types';
import { playFanfare } from '../lib/fanfare';
import { CardTile } from './CardTile';

const COLORS = ['#f5d76e', '#f4a261', '#7dd3fc', '#f9a8d4', '#86efac', '#fff7d6'];
const SWIPE_PX = 110;
const SWIPE_SPEED = 0.5;
const EXIT_MS = 280;
const FOLLOW_RANGE = 280;

function followAxis(finger: number) {
  const mag = Math.abs(finger);
  const t = Math.min(mag / FOLLOW_RANGE, 1.45);
  const gain = 0.07 + t * t * t * 1.7;
  return Math.sign(finger) * mag * gain;
}

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
  const [pieces] = useState(() => burstPieces(48));
  const pointer = useRef({ x: 0, y: 0, t: 0, tracking: false });
  const leaving = useRef(false);
  const shell = document.querySelector('.app-shell');

  useEffect(() => {
    playFanfare(audio);
    setIndex(0);
    setDrag({ x: 0, y: 0, active: false });
    setExit(null);
    leaving.current = false;
  }, [audio, cards]);

  const dismiss = useCallback(
    (dir: ExitDir) => {
      if (leaving.current) return;
      leaving.current = true;
      setExit(dir);
      window.setTimeout(() => {
        const next = index + 1;
        if (next >= cards.length) {
          onDone();
          return;
        }
        leaving.current = false;
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
    pointer.current = { x: event.clientX, y: event.clientY, t: performance.now(), tracking: true };
    setDrag({ x: 0, y: 0, active: true });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current.tracking || leaving.current) return;
    setDrag({
      x: event.clientX - pointer.current.x,
      y: event.clientY - pointer.current.y,
      active: true,
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current.tracking || leaving.current) return;
    pointer.current.tracking = false;
    const x = event.clientX - pointer.current.x;
    const y = event.clientY - pointer.current.y;
    const dt = Math.max(performance.now() - pointer.current.t, 1);
    const speed = Math.hypot(x, y) / dt;
    if (Math.hypot(x, y) >= SWIPE_PX || speed >= SWIPE_SPEED) {
      dismiss(exitFromDelta(x, y));
      return;
    }
    setDrag({ x: 0, y: 0, active: false });
  }

  const remaining = cards.slice(index, index + 2);
  const moveX = followAxis(drag.x);
  const moveY = followAxis(drag.y);
  const rotate = moveX / 28;

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
            return (
              <div
                key={`${card.id}-${index + depth}`}
                className={`pack-card${top && exit ? ` ${exitClass(exit)}` : ''}`}
                style={{
                  zIndex: 2 - depth,
                  pointerEvents: top ? 'auto' : 'none',
                  ['--shine-x' as string]: `${Math.max(12, Math.min(90, 72 - moveX / 5))}%`,
                  transform:
                    top && !exit
                      ? `translate(${moveX}px, ${moveY}px) rotate(${rotate}deg)`
                      : undefined,
                  transition: top && drag.active && !exit ? 'none' : undefined,
                }}
                onPointerDown={top ? onPointerDown : undefined}
                onPointerMove={top ? onPointerMove : undefined}
                onPointerUp={top ? onPointerUp : undefined}
                onPointerCancel={top ? onPointerUp : undefined}
              >
                <CardTile card={card} />
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
