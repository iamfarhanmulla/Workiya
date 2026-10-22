"use client";

import { COL_CFG, STATUSES } from "./activityConfig";

const VIEWS = [
  { value: "kanban", icon: "view_kanban", title: "Board" },
  { value: "list", icon: "table_rows", title: "List" },
  {
    value: "review", icon: "rate_review", title: "Pending review", staffOnly: true,
  },
];

function ViewButtons({ view, onViewChange, isStaff }) {
  return (
    <div className="tasks-view-btns" style={{ marginLeft: "auto" }}>
      {VIEWS.filter((v) => isStaff || !v.staffOnly).map((v) => (
        <button
          type="button"
          key={v.value}
          className={`tasks-view-btn${view === v.value ? " active" : ""}`}
          onClick={() => onViewChange(v.value)}
          title={v.title}
          aria-label={v.title}
          aria-pressed={view === v.value}
        >
          <span className="material-symbols-outlined">{v.icon}</span>
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
    <div className="tasks-toolbar">
      <div className="co-search" style={{ maxWidth: 260 }}>
        <span className="material-symbols-outlined">search</span>
        <input
          type="text"
          aria-label={searchLabel}
          placeholder={`${searchLabel}...`}
          value={filters.search}
          onChange={set("search")}
        />
      </div>
      <select
        className="co-filter-select"
        aria-label="Status"
        value={filters.status}
        onChange={set("status")}
      >
        <option value="all">All Statuses</option>
        {STATUSES.map((s) => <option key={s} value={s}>{COL_CFG[s].label}</option>)}
      </select>
      <select
        className="co-filter-select"
        aria-label="Priority"
        value={filters.priority}
        onChange={set("priority")}
      >
        <option value="all">All Priorities</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
      <ViewButtons view={view} onViewChange={onViewChange} isStaff={isStaff} />
    </div>
  );
}
