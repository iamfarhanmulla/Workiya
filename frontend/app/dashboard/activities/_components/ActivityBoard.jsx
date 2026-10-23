"use client";

import { ACTIVITY_STATUS } from "@/components/status";
import { STATUSES } from "./activityConfig";
import ActivityCard from "./ActivityCard";

function BoardColumn({ status, activities, board }) {
  const meta = ACTIVITY_STATUS[status];
  const cards = activities.filter((a) => a.status === status);
  return (
    <section className="wk-board-col" aria-label={meta.label}>
      <div className="wk-board-col-hd">
        <span className={meta.pill}>{meta.label}</span>
        <span className="wk-count">{cards.length}</span>
      </div>
      {cards.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          isStaff={board.isStaff}
          moves={board.movesFor(activity)}
          onView={board.onView}
          onEdit={board.onEdit}
          onDelete={board.onDelete}
          onMove={board.onMove}
        />
      ))}
      {cards.length === 0 && <p className="wk-board-empty">{board.emptyLabel}</p>}
      {board.isStaff && (
        <button
          type="button"
          className="wk-btn wk-btn--ghost wk-btn--sm wk-board-add"
          onClick={board.onAdd}
        >
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          Add
        </button>
      )}
    </section>
  );
}

// Status columns; `board` carries isStaff, movesFor, emptyLabel and the card handlers.
export default function ActivityBoard({ activities, board }) {
  return (
    <div className="wk-board">
      {STATUSES.map((status) => (
        <BoardColumn key={status} status={status} activities={activities} board={board} />
      ))}
    </div>
  );
}
