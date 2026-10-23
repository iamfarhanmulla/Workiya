"use client";

// Fixed account fields, in rows of one, two or three columns.
const ROWS = [
  [{ key: "name", label: "Name", required: true }],
  [
    {
      key: "phoneNumber", label: "Phone Number", type: "tel", placeholder: "+91 98765 43210",
    },
    {
      key: "email", label: "Email", type: "email", placeholder: "contact@example.com",
    },
  ],
  [{ key: "address", label: "Full Address", placeholder: "Building, Street, Area" }],
  [
    { key: "city", label: "City", placeholder: "Mumbai" },
    { key: "state", label: "State", placeholder: "Maharashtra" },
    { key: "country", label: "Country", placeholder: "India" },
  ],
  [
    {
      key: "latitude", label: "Latitude", placeholder: "19.0596", inputMode: "decimal",
    },
    {
      key: "longitude", label: "Longitude", placeholder: "72.8295", inputMode: "decimal",
    },
  ],
];

const ROW_CLASS = { 2: "wk-form-row", 3: "wk-form-row wk-form-row--3" };

function Field({
  field, value, onChange, idPrefix, label,
}) {
  const id = `${idPrefix}-${field.key}`;
  return (
    <div className="wk-field">
      <label htmlFor={id} className="wk-label">
        {label}
        {field.required && <span className="wk-req" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        className="wk-input"
        type={field.type || "text"}
        inputMode={field.inputMode}
        placeholder={field.placeholder}
        required={field.required}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
      />
    </div>
  );
}

export default function AccountFormFields({
  form, onChange, singular, idPrefix,
}) {
  return (
    <>
      {ROWS.map((row) => {
        const fields = row.map((field) => (
          <Field
            key={field.key}
            field={field}
            idPrefix={idPrefix}
            label={field.key === "name" ? `${singular} Name` : field.label}
            value={form[field.key]}
            onChange={onChange}
          />
        ));
        return row.length > 1
          ? <div key={row[0].key} className={ROW_CLASS[row.length]}>{fields}</div>
          : fields;
      })}
      <div className="wk-field">
        <label htmlFor={`${idPrefix}-notes`} className="wk-label">Notes</label>
        <textarea
          id={`${idPrefix}-notes`}
          className="wk-textarea"
          rows={3}
          placeholder="Visit between 10am–12pm. Ask at reception…"
          value={form.notes}
          onChange={(e) => onChange("notes", e.target.value)}
        />
      </div>
    </>
  );
}
