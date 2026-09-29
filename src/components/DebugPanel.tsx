import { Link, useLocation, useNavigate } from 'react-router-dom';
import { debugMode } from '../lib/geo';
import { resetApp } from '../lib/storage';
import { trimetQueryCount, resetTrimetQueryCount } from '../lib/trimetQueries';

export function DebugPanel() {
  const location = useLocation();
  const navigate = useNavigate();
  if (!debugMode(location.search)) return null;

  return (
    <div className="debug-panel">
      <h2>Debug</h2>
      <p className="debug-stat">TriMet queries this tab: {trimetQueryCount()}</p>
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
        <button type="button" className="ghost" onClick={() => navigate('/?pack=preview')}>
          Preview pack
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void (async () => {
              if (!window.confirm('Reset album, log, cooldowns, and TriMet query count?')) return;
              resetTrimetQueryCount();
              await resetApp();
              window.location.reload();
            })();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
