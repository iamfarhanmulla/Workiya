"use client";

import { ACTIVITY_STATUS } from "@/components/status";
import { STATUSES } from "./activityConfig";

const VIEWS = [
  { value: "kanban", icon: "view_kanban", title: "Board" },
  { value: "list", icon: "table_rows", title: "List" },
  {
    value: "review", icon: "rate_review", title: "Pending review", staffOnly: true,
  },
];

function ViewButtons({ view, onViewChange, isStaff }) {
  return (
    <div className="wk-seg" role="group" aria-label="View">
      {VIEWS.filter((v) => isStaff || !v.staffOnly).map((v) => (
        <button
          type="button"
          key={v.value}
          aria-pressed={view === v.value}
          onClick={() => onViewChange(v.value)}
        >
          <span className="material-symbols-outlined" aria-hidden="true">{v.icon}</span>
          {v.title}
        </button>
      ))}
    </div>
  );
}

export default function ActivityToolbar({
  filters, onFilterChange, view, onViewChange, isStaff, plural,
}) {
  const set = (key) => (e) => onFilterChange({ ...filters, [key]: e.target.value });
  const searchLabel = `Search ${plural.toLowerCase()}`;
  return (
    <div className="wk-toolbar wk-toolbar--bare">
      <div className="wk-input-wrap wk-toolbar-search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input
          type="text"
          className="wk-input"
          aria-label={searchLabel}
          placeholder={`${searchLabel}…`}
          value={filters.search}
          onChange={set("search")}
        />
      </div>
      <select
        className="wk-select wk-toolbar-select"
        aria-label="Status"
        value={filters.status}
        onChange={set("status")}
      >
        <option value="all">All statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{ACTIVITY_STATUS[s].label}</option>)}
      </select>
      <select
        className="wk-select wk-toolbar-select"
        aria-label="Priority"
        value={filters.priority}
        onChange={set("priority")}
      >
        <option value="all">All priorities</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
      <span className="wk-spacer" />
      <ViewButtons view={view} onViewChange={onViewChange} isStaff={isStaff} />
    </div>
  );
}
