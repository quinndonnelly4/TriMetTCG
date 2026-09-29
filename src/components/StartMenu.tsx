import { type Ref } from 'react';

export function StartMenu({
  readerRef,
  screenRef,
  valid,
  open,
  validUntil,
  date,
  time,
  onPlay,
}: {
  readerRef: Ref<HTMLDivElement>;
  screenRef: Ref<HTMLDivElement>;
  valid: boolean;
  open: boolean;
  validUntil: string | null;
  date: string;
  time: string;
  onPlay: () => void;
}) {
  return (
    <div
      className={`hop-reader${valid ? ' is-valid' : ''}${open ? ' is-open' : ''}`}
      ref={readerRef}
    >
      <div className="hop-face">
        <div className="hop-screen" ref={screenRef}>
          <h1 className="hop-title">TriMet Collector</h1>
          <div className="hop-valid" aria-live="polite">
            <svg className="hop-check" viewBox="0 0 72 72" aria-hidden="true">
              <path className="hop-check-border" d="M16 38 L30 52 L58 22" />
              <path className="hop-check-mark" d="M16 38 L30 52 L58 22" />
            </svg>
            {validUntil ? <p className="hop-valid-until">Valid until {validUntil}</p> : null}
          </div>
          <div className="hop-lcd-meta">
            <span>{date}</span>
            <span>{time}</span>
          </div>
        </div>
        <div className="hop-pad">
          <button
            type="button"
            className="hop-play"
            aria-expanded={open}
            aria-busy={valid && !open}
            onClick={onPlay}
          >
            <span className="hop-play-label">Play</span>
          </button>
        </div>
      </div>
    </div>
  );
}
