"use client";

import { COL_CFG } from "./activityConfig";

// Small coloured "move to" buttons; `compact` is the card size, otherwise the modal size.
export default function StatusMoveButtons({ moves, onMove, compact = false }) {
  if (!moves.length) return null;
  return (
    <div style={{ display: "flex", gap: compact ? 4 : 6, flexWrap: "wrap" }}>
      {moves.map((move) => {
        const cfg = COL_CFG[move.status];
        return (
          <button
            type="button"
            key={move.status}
            onClick={() => onMove(move.status)}
            style={{
              fontSize: compact ? 9 : 11,
              fontWeight: 700,
              padding: compact ? "2px 7px" : "5px 12px",
              borderRadius: compact ? 6 : 8,
              border: `1px solid ${cfg.border}`,
              background: cfg.countBg,
              color: cfg.countColor,
              cursor: "pointer",
            }}
          >
            {compact ? `→ ${move.label}` : move.label}
          </button>
        );
      })}
    </div>
  );
}
