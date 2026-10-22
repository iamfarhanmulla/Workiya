"use client";

import { COL_CFG, STATUSES } from "./activityConfig";
import ActivityCard from "./ActivityCard";

const EMPTY = {
  textAlign: "center", padding: "24px 0", color: "var(--ds-text-2)", fontSize: 12,
};

function ColumnHeader({ cfg, count }) {
  return (
    <div className="tasks-col-hd" style={{ borderBottomColor: cfg.dot }}>
      <div className="tasks-col-dot" style={{ background: cfg.dot }} />
      <span className="tasks-col-title">{cfg.label}</span>
      <span className="tasks-col-count" style={{ background: cfg.countBg, color: cfg.countColor }}>
        {count}
      </span>
    </div>
  );
}

function BoardColumn({
  status, activities, board,
}) {
  const cfg = COL_CFG[status];
  const cards = activities.filter((a) => a.status === status);
  return (
    <div className="tasks-col">
      <ColumnHeader cfg={cfg} count={cards.length} />
      {cards.map((activity, i) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          index={i}
          isStaff={board.isStaff}
          moves={board.movesFor(activity)}
          onView={board.onView}
          onEdit={board.onEdit}
          onDelete={board.onDelete}
          onMove={board.onMove}
        />
      ))}
      {cards.length === 0 && <div style={EMPTY}>{board.emptyLabel}</div>}
      {board.isStaff && (
        <button type="button" className="task-add-btn" onClick={board.onAdd}>
          <span className="material-symbols-outlined">add</span>
          Add
        </button>
      )}
    </div>
  );
}

// Status columns; `board` carries isStaff, movesFor, emptyLabel and the card handlers.
export default function ActivityBoard({ activities, board }) {
  return (
    <div className="tasks-board">
      {STATUSES.map((status) => (
        <BoardColumn key={status} status={status} activities={activities} board={board} />
      ))}
    </div>
  );
}
