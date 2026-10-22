"use client";

function ViewButton({
  mode, icon, view, onView, label,
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={view === mode}
      className={`tasks-view-btn${view === mode ? " active" : ""}`}
      onClick={() => onView(mode)}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </button>
  );
}

export default function AccountsToolbar({
  plural, list, view, onView,
}) {
  return (
    <div className="co-toolbar">
      <div className="co-search">
        <span className="material-symbols-outlined">search</span>
        <input
          type="text"
          aria-label={`Search ${plural.toLowerCase()}`}
          placeholder={`Search ${plural.toLowerCase()}, cities, phone...`}
          value={list.search}
          onChange={(e) => list.setSearch(e.target.value)}
        />
      </div>
      <select
        className="co-filter-select"
        aria-label="Status filter"
        value={list.status}
        onChange={(e) => list.setStatus(e.target.value)}
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <div className="tasks-view-btns" style={{ marginLeft: "auto" }}>
        <ViewButton mode="grid" icon="grid_view" label="Grid view" view={view} onView={onView} />
        <ViewButton mode="list" icon="table_rows" label="List view" view={view} onView={onView} />
      </div>
    </div>
  );
}
