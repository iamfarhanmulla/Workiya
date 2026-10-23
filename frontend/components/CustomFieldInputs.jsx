"use client";

const INPUT_TYPES = {
  TEXT: "text",
  NUMBER: "number",
  DATE: "date",
  PHONE: "tel",
  EMAIL: "email",
};

const FIELDSET_STYLE = { border: 0, margin: 0, padding: 0 };

function isEmpty(value) {
  return value === undefined || value === null || value === ""
    || (Array.isArray(value) && value.length === 0);
}

// Empty values are left out, so an optional field the user cleared is not sent.
export function setFieldValue(values, fieldKey, value) {
  const next = { ...(values ?? {}) };
  if (isEmpty(value)) delete next[fieldKey];
  else next[fieldKey] = value;
  return next;
}

function parseInput(field, raw) {
  if (field.dataType !== "NUMBER" || raw === "") return raw;
  const num = Number(raw);
  return Number.isFinite(num) ? num : raw;
}

// Reads "Label *" for a required field; the star is styled by .wk-req.
function fieldLabel(field) {
  if (!field.isRequired) return field.label;
  return (
    <>
      {`${field.label} `}
      <span className="wk-req">*</span>
    </>
  );
}

const describedBy = (id, error) => (error ? `${id}-error` : undefined);
const invalid = (error) => (error ? true : undefined);

function FieldError({ id, error }) {
  if (!error) return null;
  return <p id={`${id}-error`} role="alert" className="wk-error-text">{error}</p>;
}

function TextLikeInput({
  field, id, value, error, onValue,
}) {
  return (
    <input
      id={id}
      type={INPUT_TYPES[field.dataType] ?? "text"}
      className="wk-input"
      value={value ?? ""}
      required={field.isRequired}
      maxLength={field.dataType === "TEXT" ? 1000 : undefined}
      step={field.dataType === "NUMBER" ? "any" : undefined}
      onChange={(e) => onValue(parseInput(field, e.target.value))}
      aria-invalid={invalid(error)}
      aria-describedby={describedBy(id, error)}
    />
  );
}

function SelectInput({
  field, id, value, error, onValue,
}) {
  return (
    <select
      id={id}
      className="wk-select"
      value={value ?? ""}
      required={field.isRequired}
      onChange={(e) => onValue(e.target.value)}
      aria-invalid={invalid(error)}
      aria-describedby={describedBy(id, error)}
    >
      <option value="">Select...</option>
      {(field.options ?? []).map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function BooleanField({
  field, id, value, error, onValue,
}) {
  return (
    <div className="wk-field">
      <label htmlFor={id} className="wk-check">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onValue(e.target.checked)}
          aria-invalid={invalid(error)}
          aria-describedby={describedBy(id, error)}
        />
        {fieldLabel(field)}
      </label>
      <FieldError id={id} error={error} />
    </div>
  );
}

function MultiSelectField({
  field, id, value, error, onValue,
}) {
  const selected = Array.isArray(value) ? value : [];
  const toggle = (opt, checked) => {
    const next = checked ? [...selected, opt] : selected.filter((v) => v !== opt);
    onValue((field.options ?? []).filter((o) => next.includes(o)));
  };
  return (
    <fieldset
      className="wk-field"
      style={FIELDSET_STYLE}
      aria-describedby={describedBy(id, error)}
    >
      <legend className="wk-label">{fieldLabel(field)}</legend>
      {(field.options ?? []).map((opt, index) => (
        <label key={opt} htmlFor={`${id}-${index}`} className="wk-check">
          <input
            id={`${id}-${index}`}
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={(e) => toggle(opt, e.target.checked)}
          />
          {opt}
        </label>
      ))}
      <FieldError id={id} error={error} />
    </fieldset>
  );
}

function LabelledField({
  field, id, value, error, onValue,
}) {
  const Control = field.dataType === "SELECT" ? SelectInput : TextLikeInput;
  return (
    <div className="wk-field">
      <label htmlFor={id} className="wk-label">{fieldLabel(field)}</label>
      <Control field={field} id={id} value={value} error={error} onValue={onValue} />
      <FieldError id={id} error={error} />
    </div>
  );
}

const FIELD_COMPONENTS = {
  BOOLEAN: BooleanField,
  MULTI_SELECT: MultiSelectField,
};

export default function CustomFieldInputs({
  fields, values, onChange, errors = {}, idPrefix = "custom-field",
}) {
  if (!fields?.length) return null;
  return (
    <>
      {fields.map((field) => {
        const Field = FIELD_COMPONENTS[field.dataType] ?? LabelledField;
        return (
          <Field
            key={field.fieldKey}
            field={field}
            id={`${idPrefix}-${field.fieldKey}`}
            value={values?.[field.fieldKey]}
            error={errors?.[field.fieldKey]}
            onValue={(value) => onChange(setFieldValue(values, field.fieldKey, value))}
          />
        );
      })}
    </>
  );
}
