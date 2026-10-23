"use client";

import StatTile from "@/components/StatTile";

export default function ActivityHeader({
  labels, activities, total, isStaff, onAdd,
}) {
  const count = (status) => activities.filter((a) => a.status === status).length;
  const subtitle = `Create, assign and track ${labels.account.toLowerCase()} `
    + `${labels.activities.toLowerCase()}`;
  return (
    <>
      <div className="wk-page-hd">
        <div>
          <h1 className="wk-page-title">{labels.activities}</h1>
          <p className="wk-page-sub">{subtitle}</p>
        </div>
        {isStaff && (
          <div className="wk-actions">
            <button type="button" className="wk-btn wk-btn--primary" onClick={onAdd}>
              <span className="material-symbols-outlined" aria-hidden="true">add</span>
              {`New ${labels.activity}`}
            </button>
          </div>
        )}
      </div>
      <div className="wk-kpis">
        <StatTile icon="event_note" label={`Total ${labels.activities}`} value={total} />
        <StatTile icon="pending_actions" label="Pending" value={count("Pending")} />
        <StatTile icon="sync" label="In progress" value={count("InProgress")} />
        <StatTile icon="task_alt" label="Completed" value={count("Completed")} />
      </div>
    </>
  );
}
