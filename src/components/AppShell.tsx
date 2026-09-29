import { useRef, type MouseEvent, type PointerEvent, type ReactNode, type SVGProps } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

function TabIcon({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

function skipPan(target: EventTarget | null) {
  return Boolean(
    (target as HTMLElement | null)?.closest?.(
      '.pack-overlay, .confirm-overlay, .pack-card, .hop-play, .play-field, .ride-recent-grid',
    ),
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const onHome = location.pathname === '/';
  const mainRef = useRef<HTMLElement>(null);
  const pan = useRef({
    x: 0,
    y: 0,
    scrollTop: 0,
    scrollLeft: 0,
    t: 0,
    vx: 0,
    tracking: false,
    axis: null as null | 'x' | 'y',
    ignore: false,
    scroller: null as HTMLElement | null,
  });
  const swallowClick = useRef(false);
  const coast = useRef(0);

  function stopCoast() {
    if (coast.current) cancelAnimationFrame(coast.current);
    coast.current = 0;
  }

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    stopCoast();
    if (skipPan(event.target) || event.pointerType !== 'mouse') {
      pan.current.ignore = true;
      return;
    }
    const scroller = (event.target as HTMLElement).closest('.album-scroller') as HTMLElement | null;
    pan.current = {
      x: event.clientX,
      y: event.clientY,
      scrollTop: mainRef.current?.scrollTop ?? 0,
      scrollLeft: scroller?.scrollLeft ?? 0,
      t: performance.now(),
      vx: 0,
      tracking: true,
      axis: null,
      ignore: false,
      scroller,
    };
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (!pan.current.tracking || pan.current.ignore || !mainRef.current) return;
    const dx = event.clientX - pan.current.x;
    const dy = event.clientY - pan.current.y;
    if (!pan.current.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      pan.current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* optional */
      }
    }
    if (pan.current.axis === 'y') {
      mainRef.current.scrollTop = pan.current.scrollTop - dy;
      return;
    }
    if (pan.current.scroller) {
      const now = performance.now();
      const dt = Math.max(now - pan.current.t, 8);
      pan.current.vx = (pan.current.scrollLeft - dx - pan.current.scroller.scrollLeft) / dt;
      pan.current.t = now;
      pan.current.scroller.scrollLeft = pan.current.scrollLeft - dx;
    }
  }

  function onPointerUp() {
    if (pan.current.axis) swallowClick.current = true;
    if (pan.current.axis === 'x' && pan.current.scroller) {
      const scroller = pan.current.scroller;
      let v = pan.current.vx * 16;
      const step = () => {
        v *= 0.93;
        scroller.scrollLeft += v;
        if (Math.abs(v) > 0.45) {
          coast.current = requestAnimationFrame(step);
          return;
        }
        coast.current = 0;
      };
      coast.current = requestAnimationFrame(step);
    }
    pan.current.tracking = false;
    pan.current.ignore = false;
    pan.current.axis = null;
    pan.current.scroller = null;
  }

  function onClickCapture(event: MouseEvent<HTMLElement>) {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <>
      <div className="orient-lock" role="alert">
        <p>Turn your phone upright to play</p>
      </div>
      <div className="app-shell" onDragStart={(event) => event.preventDefault()}>
      <main
        ref={mainRef}
        className={onHome ? 'main-home' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
      >
        {children}
      </main>
      <nav className="tab-bar">
        <NavLink to={{ pathname: '/', search: location.search }} end>
          <TabIcon>
            <path
              fill="currentColor"
              d="M4 16.2V12h1.1l1-4.4h11.8l1 4.4H20v4.2h-1.6a2.2 2.2 0 0 1-4.4 0H10a2.2 2.2 0 0 1-4.4 0H4Zm4.2-4.2h7.6l-.45-2H8.65l-.45 2Z"
            />
          </TabIcon>
          Ride
        </NavLink>
        <NavLink to={{ pathname: '/collection', search: location.search }}>
          <TabIcon>
            <path
              fill="currentColor"
              d="M6.2 5.2h9.2v13.6H6.2V5.2Zm10.4 1.6h1.2v12.4H8.2v1.2h9.6V6.8H16.6Z"
            />
          </TabIcon>
          Album
        </NavLink>
        <NavLink to={{ pathname: '/log', search: location.search }}>
          <TabIcon>
            <path
              fill="currentColor"
              d="M5 6h14v1.8H5V6Zm0 5.1h14v1.8H5v-1.8Zm0 5.1h10v1.8H5V16.2Z"
            />
          </TabIcon>
          Log
        </NavLink>
      </nav>
    </div>
    </>
  );
}
