const EMPTY = "—";

function isEmpty(value) {
  return value === undefined || value === null || value === ""
    || (Array.isArray(value) && value.length === 0);
}

export function formatFieldValue(field, value) {
  if (isEmpty(value)) return EMPTY;
  if (field.dataType === "BOOLEAN") {
    if (typeof value !== "boolean") return EMPTY;
    return value ? "Yes" : "No";
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default function CustomFieldValues({ fields, values }) {
  if (!fields?.length) return null;
  return (
    <dl className="wk-dl custom-field-values">
      {fields.map((field) => (
        <div key={field.fieldKey} className="custom-field-value">
          <dt>{field.label}</dt>
          <dd>{formatFieldValue(field, values?.[field.fieldKey])}</dd>
        </div>
      ))}
    </dl>
  );
}
