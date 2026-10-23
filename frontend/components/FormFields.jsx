"use client";

// Labelled inputs for dialogs and forms. onChange receives the new value, not the event.

function Label({ id, label, required }) {
  return (
    <label htmlFor={id} className="wk-label">
      {label}
      {required && <span className="wk-req" aria-hidden="true">*</span>}
    </label>
  );
}

export function TextField({
  id, label, required = false, value, onChange, type = "text", placeholder, hint,
  autoComplete,
}) {
  return (
    <div className="wk-field">
      <Label id={id} label={label} required={required} />
      <input
        id={id}
        className="wk-input"
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-describedby={hint ? `${id}-hint` : undefined}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="wk-help" id={`${id}-hint`}>{hint}</span>}
    </div>
  );
}

// options: [{ value, label }]. placeholder adds an empty first option.
export function SelectField({
  id, label, required = false, value, onChange, options, placeholder,
}) {
  return (
    <div className="wk-field">
      <Label id={id} label={label} required={required} />
      <select
        id={id}
        className="wk-select"
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
