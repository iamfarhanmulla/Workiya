"use client";

function ViewButton({
  mode, icon, text, label, view, onView,
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={view === mode}
      onClick={() => onView(mode)}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
      {text}
    </button>
  );
}

export default function AccountsToolbar({
  plural, list, view, onView,
}) {
  const lower = plural.toLowerCase();
  const toggle = { view, onView };
  return (
    <div className="wk-toolbar">
      <div className="wk-input-wrap wk-toolbar-search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input
          type="text"
          className="wk-input"
          aria-label={`Search ${lower}`}
          placeholder={`Search ${lower}, cities, phone…`}
          value={list.search}
          onChange={(e) => list.setSearch(e.target.value)}
        />
      </div>
      <select
        className="wk-select wk-toolbar-select"
        aria-label="Status filter"
        value={list.status}
        onChange={(e) => list.setStatus(e.target.value)}
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
      <span className="wk-spacer" />
      <div className="wk-seg" role="group" aria-label="Layout">
        <ViewButton mode="grid" icon="grid_view" text="Grid" label="Grid view" {...toggle} />
        <ViewButton mode="list" icon="table_rows" text="List" label="List view" {...toggle} />
      </div>
    </div>
  );
}
