"use client";

import { PriorityTag, StatusPill } from "@/components/status";
import { fmtDate, initials, isOverdue } from "./activityConfig";
import RowButton from "./RowButton";

function TitleCell({ activity }) {
  const description = activity.description || "";
  const short = description.length > 60 ? `${description.slice(0, 60)}…` : description;
  return (
    <td>
      <div className="wk-person-name">{activity.title}</div>
      {short && <div className="wk-person-meta">{short}</div>}
    </td>
  );
}

function ActivityRow({
  activity, isStaff, onView, onEdit, onDelete,
}) {
  const overdue = isOverdue(activity);
  return (
    <tr>
      <td className="wk-mono wk-muted">{`#${activity.id}`}</td>
      <TitleCell activity={activity} />
      <td>
        <div>{activity.accountName || "—"}</div>
        {activity.activityTypeName && (
          <div className="wk-person-meta">{activity.activityTypeName}</div>
        )}
      </td>
      <td>
        <div className="wk-person">
          <span className="wk-avatar wk-avatar--xs" aria-hidden="true">
            {initials(activity.assignedToName)}
          </span>
          <span>{activity.assignedToName || "—"}</span>
        </div>
      </td>
      <td><PriorityTag priority={activity.priority} /></td>
      <td><StatusPill status={activity.status} /></td>
      <td className={overdue ? "wk-cell-overdue" : undefined}>
        {fmtDate(activity.dueAtUtc) || "—"}
      </td>
      <td className="col-actions">
        <div className="wk-row-actions">
          <RowButton icon="visibility" label="View" onClick={() => onView(activity)} />
          {isStaff && <RowButton icon="edit" label="Edit" onClick={() => onEdit(activity)} />}
          {isStaff && (
            <RowButton icon="delete" label="Delete" danger onClick={() => onDelete(activity)} />
          )}
        </div>
      </td>
    </tr>
  );
}

export default function ActivityTable({
  activities, accountLabel, emptyLabel, isStaff, onView, onEdit, onDelete,
}) {
  if (!activities.length) {
    return (
      <div className="wk-empty">
        <div className="wk-empty-icon">
          <span className="material-symbols-outlined wk-icon--lg" aria-hidden="true">
            search_off
          </span>
        </div>
        <div className="wk-empty-title">{emptyLabel}</div>
      </div>
    );
  }
  return (
    <div className="wk-table-wrap" style={{ borderTop: 0 }}>
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Title</th>
            <th scope="col">{accountLabel}</th>
            <th scope="col">Assigned to</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col">Due</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              isStaff={isStaff}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
