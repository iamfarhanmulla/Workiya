"use client";

// Search box plus filter dropdowns above a list.
// filters: [{ key, label, value, onChange(value), allLabel, options: [{ value, label }] }].
export default function ListToolbar({
  search, onSearch, searchLabel, placeholder, filters = [], children,
}) {
  return (
    <div className="wk-toolbar">
      <div className="wk-input-wrap wk-toolbar-search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input
          type="text"
          className="wk-input"
          aria-label={searchLabel}
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {filters.map((f) => (
        <select
          key={f.key}
          className="wk-select wk-toolbar-select"
          aria-label={f.label}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
        >
          <option value="All">{f.allLabel}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {children}
    </div>
  );
}
