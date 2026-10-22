// A KPI tile: label with icon, a big value, and optional extra lines (meter, footnote).
export default function StatTile({
  icon, label, value, total, tone, children,
}) {
  return (
    <div className="wk-card wk-stat">
      <span className="wk-stat-label">
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        {label}
      </span>
      <span className={`wk-stat-value${tone ? ` wk-stat-value--${tone}` : ""}`}>
        {value}
        {total != null && <small>{`/ ${total}`}</small>}
      </span>
      {children}
    </div>
  );
}
