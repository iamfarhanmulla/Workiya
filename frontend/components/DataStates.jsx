// Meter, loading skeleton and load-error banner shared by the rebuilt pages.

export function Meter({
  pct, tone, label, showLabel = false,
}) {
  const fill = { width: `${pct}%` };
  if (tone) fill.background = `var(--color-${tone})`;
  return (
    <div className="wk-meter-row">
      <div className="wk-meter" role="img" aria-label={label}>
        <span style={fill} />
      </div>
      {showLabel && <span className="wk-meter-label" aria-hidden="true">{label}</span>}
    </div>
  );
}

export function SkeletonRows({ rows, tiles = false }) {
  const keys = Array.from({ length: rows }, (_, i) => i);
  if (tiles) {
    return (
      <div className="wk-kpis" aria-busy="true" aria-label="Loading">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="wk-card wk-stat">
            <span className="wk-skel" style={{ width: "50%" }} />
            <span className="wk-skel" style={{ width: "35%", height: 28 }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="wk-card-bd wk-skeleton-rows" aria-busy="true" aria-label="Loading">
      {keys.map((k) => (
        <span key={k} className="wk-skel" style={{ width: `${80 - (k % 3) * 15}%` }} />
      ))}
    </div>
  );
}

export function LoadError({ what, onRetry }) {
  return (
    <div className="wk-banner wk-banner--danger" role="alert">
      <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
      <div>
        <strong>{`Couldn't load ${what}`}</strong>
        <button
          type="button"
          className="wk-btn wk-btn--secondary wk-btn--sm wk-retry"
          onClick={onRetry}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
