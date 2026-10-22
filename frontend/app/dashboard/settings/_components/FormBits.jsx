"use client";

export function SectionTitle({
  icon, color, children, style,
}) {
  return (
    <div className="stg-section-title" style={style}>
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 18, color, fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
        {children}
      </span>
    </div>
  );
}

export function TextField({
  id, label, value, onChange, type = "text", disabled = false, required = false, placeholder,
}) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
        {required && <span style={{ color: "#EF4444" }}> *</span>}
      </label>
      <input
        id={id}
        className="form-input"
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function CheckboxField({
  id, label, checked, onChange,
}) {
  return (
    <label
      htmlFor={id}
      className="form-label"
      style={{
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function StatusBadge({ active }) {
  return (
    <span className={`badge ${active ? "badge-success" : "badge-gray"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function RowActions({ name, onEdit, onDelete }) {
  return (
    <div className="action-btns">
      <button
        type="button"
        className="icon-btn"
        title="Edit"
        aria-label={`Edit ${name}`}
        onClick={onEdit}
      >
        <span className="material-symbols-outlined">edit</span>
      </button>
      <button
        type="button"
        className="icon-btn icon-btn-danger"
        title="Delete"
        aria-label={`Delete ${name}`}
        onClick={onDelete}
      >
        <span className="material-symbols-outlined">delete</span>
      </button>
    </div>
  );
}

export function AddButton({ label, onClick }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={onClick}>
        <span className="material-symbols-outlined" aria-hidden="true">add</span>
        {label}
      </button>
    </div>
  );
}
