"use client";

export function SectionTitle({ children }) {
  return <h3 className="wk-caps">{children}</h3>;
}

// One icon + label + value line of a detail view; renders nothing without a value.
export default function DetailRow({ icon, label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="wk-detail-row">
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      <div>
        <div className="wk-detail-label">{label}</div>
        <div className="wk-detail-value">{value}</div>
      </div>
    </div>
  );
}
