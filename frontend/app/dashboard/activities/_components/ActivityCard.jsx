"use client";

import { PriorityTag, REVIEW_STATUS, StatusPill } from "@/components/status";
import { fmtDate, initials, isOverdue } from "./activityConfig";
import RowButton from "./RowButton";
import StatusMoveButtons from "./StatusMoveButtons";

function CardMeta({ icon, children }) {
  return (
    <div className="wk-act-card-meta">
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      {children}
    </div>
  );
}

function CardFooter({ activity }) {
  const overdue = isOverdue(activity);
  return (
    <div className="wk-act-card-ft">
      {activity.dueAtUtc ? (
        <span className={`wk-act-card-due${overdue ? " is-overdue" : ""}`}>
          <span className="material-symbols-outlined" aria-hidden="true">event</span>
          {`${overdue ? "Overdue · " : ""}${fmtDate(activity.dueAtUtc)}`}
        </span>
      ) : <span />}
      <span className="wk-person" title={activity.assignedToName}>
        <span className="wk-avatar wk-avatar--xs" aria-hidden="true">
          {initials(activity.assignedToName)}
        </span>
        <span className="wk-person-meta">{activity.assignedToName}</span>
      </span>
    </div>
  );
}

export default function ActivityCard({
  activity, isStaff, moves, onView, onEdit, onDelete, onMove,
}) {
  const review = activity.latestSubmission?.reviewStatus;
  return (
    <article className="wk-card wk-act-card">
      <div className="wk-act-card-top">
        <span className="wk-mono wk-muted">{`#${activity.id}`}</span>
        <PriorityTag priority={activity.priority} />
      </div>
      <h3 className="wk-act-card-title">{activity.title}</h3>
      {activity.accountName && <CardMeta icon="storefront">{activity.accountName}</CardMeta>}
      {activity.activityTypeName && (
        <CardMeta icon="category">{activity.activityTypeName}</CardMeta>
      )}
      {review && <div><StatusPill status={review} map={REVIEW_STATUS} /></div>}
      <CardFooter activity={activity} />
      <div className="wk-act-card-actions">
        <RowButton icon="visibility" label="View" onClick={() => onView(activity)} />
        {isStaff && <RowButton icon="edit" label="Edit" onClick={() => onEdit(activity)} />}
        {isStaff && (
          <RowButton icon="delete" label="Delete" danger onClick={() => onDelete(activity)} />
        )}
        <StatusMoveButtons compact moves={moves} onMove={(status) => onMove(activity, status)} />
      </div>
    </article>
  );
}
