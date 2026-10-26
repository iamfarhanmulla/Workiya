"use client";

import RowButton from "@/components/RowButton";
import { ActiveState } from "@/components/PersonCell";

// A settings card: title, one-line description and an optional action on the right.
export function SettingsCard({
  id, title, desc, action, children,
}) {
  return (
    <section className="wk-card" id={id} aria-labelledby={`${id}-title`}>
      <div className="wk-card-hd">
        <div>
          <h2 className="wk-card-title" id={`${id}-title`}>{title}</h2>
          {desc && <div className="wk-card-sub">{desc}</div>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TextField({
  id, label, value, onChange, type = "text", disabled = false, required = false, placeholder,
}) {
  return (
    <div className="wk-field">
      <label htmlFor={id} className="wk-label">
        {label}
        {required && <span className="wk-req" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        className="wk-input"
        type={type}
        value={value}
        disabled={disabled}
        required={required}
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
    <label htmlFor={id} className="wk-check">
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
  return <ActiveState isActive={active} />;
}

export function RowActions({ name, onEdit, onDelete }) {
  return (
    <div className="wk-row-actions">
      <RowButton icon="edit" label={`Edit ${name}`} onClick={onEdit} />
      <RowButton icon="delete" label={`Delete ${name}`} danger onClick={onDelete} />
    </div>
  );
}

export function AddButton({ label, onClick }) {
  return (
    <button type="button" className="wk-btn wk-btn--primary wk-btn--sm" onClick={onClick}>
      <span className="material-symbols-outlined" aria-hidden="true">add</span>
      {label}
    </button>
  );
}
