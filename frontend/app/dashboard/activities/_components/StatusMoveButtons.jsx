"use client";

// "Move to" buttons; `compact` is the card size ("→ Start"), otherwise the dialog size.
export default function StatusMoveButtons({ moves, onMove, compact = false }) {
  if (!moves.length) return null;
  return (
    <div className={`wk-move-btns${compact ? " wk-move-btns--compact" : ""}`}>
      {moves.map((move) => (
        <button
          type="button"
          key={move.status}
          className={`wk-btn wk-btn--secondary ${compact ? "wk-btn--xs" : "wk-btn--sm"}`}
          onClick={() => onMove(move.status)}
        >
          {compact ? `→ ${move.label}` : move.label}
        </button>
      ))}
    </div>
  );
}
