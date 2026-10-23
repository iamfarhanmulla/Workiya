"use client";

// Icon-only action button for cards and table rows; the label is its accessible name.
export default function RowButton({
  icon, label, onClick, danger = false,
}) {
  const tone = danger ? " wk-btn--ghost-danger" : "";
  return (
    <button
      type="button"
      className={`wk-btn wk-btn--ghost wk-btn--icon wk-btn--sm${tone}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </button>
  );
}
