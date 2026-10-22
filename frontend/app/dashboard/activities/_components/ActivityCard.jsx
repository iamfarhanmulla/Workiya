"use client";

import {
  COL_CFG, PRIORITY_STYLE, fmtDate, initials, isOverdue,
} from "./activityConfig";
import StatusMoveButtons from "./StatusMoveButtons";

const AVATAR = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#6366F1,#06B6D4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 8,
  fontWeight: 700,
  color: "#fff",
  flexShrink: 0,
};

const ACTION_ROW = {
  display: "flex", gap: 4, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--ds-border)",
};

function IconAction({
  icon, title, onClick, danger = false,
}) {
  return (
    <button
      type="button"
      className={`icon-btn${danger ? " icon-btn-danger" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{ flex: 1, justifyContent: "center" }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>
    </button>
  );
}

function CardFooter({ activity }) {
  const overdue = isOverdue(activity);
  return (
    <div className="task-card-ft">
      <div className="task-card-assignee">
        <div style={AVATAR}>{initials(activity.assignedToName)}</div>
        <span style={{ fontSize: 11, color: "var(--ds-text-2)" }}>{activity.assignedToName}</span>
      </div>
      {activity.dueAtUtc && (
        <span style={{
          fontSize: 10, fontWeight: 600, color: overdue ? "#EF4444" : "var(--ds-text-2)",
        }}
        >
          {overdue ? "Overdue · " : ""}{fmtDate(activity.dueAtUtc)}
        </span>
      )}
    </div>
  );
}

function CardSummary({ activity }) {
  const ps = PRIORITY_STYLE[activity.priority] || PRIORITY_STYLE.Medium;
  return (
    <>
      <div className="task-card-top">
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 20,
          background: ps.bg,
          color: ps.color,
        }}
        >
          {activity.priority?.toUpperCase()}
        </span>
        <span className="task-card-id">#{activity.id}</span>
      </div>
      <div className="task-card-main-title">{activity.title}</div>
      {activity.accountName && (
        <div className="task-card-doctor-row">
          <span className="material-symbols-outlined">medical_services</span>
          {activity.accountName}
        </div>
      )}
      {activity.activityTypeName && (
        <div className="task-card-loc">
          <span className="material-symbols-outlined">category</span>
          {activity.activityTypeName}
        </div>
      )}
    </>
  );
}

export default function ActivityCard({
  activity, index, isStaff, moves, onView, onEdit, onDelete, onMove,
}) {
  const cfg = COL_CFG[activity.status] || COL_CFG.Pending;
  return (
    <div
      className="task-card-item"
      style={{ "--card-du": `${index * 0.05}s`, borderLeftWidth: 3, borderLeftColor: cfg.border }}
    >
      <CardSummary activity={activity} />
      <CardFooter activity={activity} />
      <div style={ACTION_ROW}>
        <IconAction icon="visibility" title="View" onClick={() => onView(activity)} />
        {isStaff && <IconAction icon="edit" title="Edit" onClick={() => onEdit(activity)} />}
        {isStaff && (
          <IconAction icon="delete" title="Delete" danger onClick={() => onDelete(activity)} />
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <StatusMoveButtons compact moves={moves} onMove={(status) => onMove(activity, status)} />
      </div>
    </div>
  );
}
