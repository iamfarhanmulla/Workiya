"use client";

import {
  COL_CFG, PILL, PRIORITY_STYLE, fmtDate, initials, isOverdue,
} from "./activityConfig";

const SUB_TEXT = { fontSize: 11, color: "var(--ds-text-2)", marginTop: 2 };
const AVATAR = { background: "linear-gradient(135deg,#6366F1,#06B6D4)", width: 28, height: 28 };

function RowButton({
  icon, title, onClick, danger = false,
}) {
  return (
    <button
      type="button"
      className={`icon-btn${danger ? " icon-btn-danger" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  );
}

function RowActions({
  activity, isStaff, onView, onEdit, onDelete,
}) {
  return (
    <div className="action-btns">
      <RowButton icon="visibility" title="View" onClick={() => onView(activity)} />
      {isStaff && <RowButton icon="edit" title="Edit" onClick={() => onEdit(activity)} />}
      {isStaff && (
        <RowButton icon="delete" title="Delete" danger onClick={() => onDelete(activity)} />
      )}
    </div>
  );
}

function AssigneeCell({ name }) {
  return (
    <div className="avatar-cell">
      <div className="avatar avatar-circle" style={AVATAR}>
        <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>{initials(name)}</span>
      </div>
      <span style={{ fontSize: 12 }}>{name || "—"}</span>
    </div>
  );
}

function TitleCell({ activity }) {
  const description = activity.description || "";
  return (
    <td>
      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ds-text)" }}>{activity.title}</div>
      {description && (
        <div style={SUB_TEXT}>
          {description.slice(0, 60)}{description.length > 60 ? "…" : ""}
        </div>
      )}
    </td>
  );
}

function ActivityRow({
  activity, index, isStaff, onView, onEdit, onDelete,
}) {
  const ps = PRIORITY_STYLE[activity.priority] || PRIORITY_STYLE.Medium;
  const cfg = COL_CFG[activity.status] || COL_CFG.Pending;
  const overdue = isOverdue(activity);
  return (
    <tr style={{ animation: `docFadeUp 0.3s ease ${index * 0.04}s both` }}>
      <td style={{ color: "var(--ds-text-2)", fontSize: 12 }}>#{activity.id}</td>
      <TitleCell activity={activity} />
      <td>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{activity.accountName || "—"}</div>
        {activity.activityTypeName && <div style={SUB_TEXT}>{activity.activityTypeName}</div>}
      </td>
      <td><AssigneeCell name={activity.assignedToName} /></td>
      <td>
        <span style={{ ...PILL, background: ps.bg, color: ps.color }}>{activity.priority}</span>
      </td>
      <td>
        <span style={{ ...PILL, background: cfg.countBg, color: cfg.countColor }}>{cfg.label}</span>
      </td>
      <td style={{
        fontSize: 12,
        color: overdue ? "#EF4444" : "var(--ds-text-2)",
        fontWeight: overdue ? 700 : 400,
      }}
      >
        {fmtDate(activity.dueAtUtc) || "—"}
      </td>
      <td>
        <RowActions
          activity={activity}
          isStaff={isStaff}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

export default function ActivityTable({
  activities, accountLabel, emptyLabel, isStaff, onView, onEdit, onDelete,
}) {
  return (
    <div style={{ margin: "0 20px 20px" }}>
      <div className="table-card" style={{ margin: 0 }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>{accountLabel}</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, i) => (
              <ActivityRow
                key={activity.id}
                activity={activity}
                index={i}
                isStaff={isStaff}
                onView={onView}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
            {activities.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="page-placeholder" style={{ minHeight: 140 }}>
                    <span className="material-symbols-outlined page-placeholder-icon">
                      search_off
                    </span>
                    <p>{emptyLabel}</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
