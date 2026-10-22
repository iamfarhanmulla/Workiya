const EMPTY = "—";
const LIST_STYLE = { margin: 0, display: "grid", gap: 8 };
const TERM_STYLE = { fontSize: 12, fontWeight: 600, color: "#6b7280" };
const VALUE_STYLE = { margin: 0, fontSize: 14 };

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
    <dl className="custom-field-values" style={LIST_STYLE}>
      {fields.map((field) => (
        <div key={field.fieldKey} className="custom-field-value">
          <dt style={TERM_STYLE}>{field.label}</dt>
          <dd style={VALUE_STYLE}>{formatFieldValue(field, values?.[field.fieldKey])}</dd>
        </div>
      ))}
    </dl>
  );
}
