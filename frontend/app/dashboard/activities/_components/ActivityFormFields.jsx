"use client";

const REQUIRED = <span style={{ color: "#EF4444" }}>*</span>;

function SelectField({
  id, label, value, onChange, placeholder, options,
}) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">{label} {REQUIRED}</label>
      <select id={id} className="form-select" value={value} onChange={onChange}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function accountOptions(accounts) {
  return accounts.map((a) => ({
    value: String(a.id), label: a.city ? `${a.name} • ${a.city}` : a.name,
  }));
}

function employeeOptions(employees) {
  return employees.map((e) => ({
    value: String(e.Id), label: e.Name,
  }));
}

function PriorityAndDue({ form, set }) {
  return (
    <div className="form-row form-row-2">
      <div className="form-group">
        <label htmlFor="act-priority" className="form-label">Priority</label>
        <select
          id="act-priority"
          className="form-select"
          value={form.priority}
          onChange={set("priority")}
        >
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="act-due" className="form-label">Due</label>
        <input
          id="act-due"
          className="form-input"
          type="datetime-local"
          value={form.dueAt}
          onChange={set("dueAt")}
        />
      </div>
    </div>
  );
}

// The inputs of the create/edit modal. `set(key)` returns the change handler for a field.
export default function ActivityFormFields({
  form, typeId, set, accounts, employees, types, accountLabel,
}) {
  return (
    <>
      <div className="form-group">
        <label htmlFor="act-title" className="form-label">Title {REQUIRED}</label>
        <input id="act-title" className="form-input" value={form.title} onChange={set("title")} />
      </div>
      <div className="form-group">
        <label htmlFor="act-description" className="form-label">Description / Instructions</label>
        <textarea
          id="act-description"
          className="form-textarea"
          rows={3}
          value={form.description}
          onChange={set("description")}
        />
      </div>
      <SelectField
        id="act-type"
        label="Type"
        value={typeId}
        onChange={set("activityTypeId")}
        placeholder="— Select type —"
        options={types.map((t) => ({ value: String(t.id), label: t.name }))}
      />
      <SelectField
        id="act-account"
        label={accountLabel}
        value={form.accountId}
        onChange={set("accountId")}
        placeholder={`— Select ${accountLabel} —`}
        options={accountOptions(accounts)}
      />
      <SelectField
        id="act-assignee"
        label="Assign To"
        value={form.assignedTo}
        onChange={set("assignedTo")}
        placeholder="— Select person —"
        options={employeeOptions(employees)}
      />
      <PriorityAndDue form={form} set={set} />
    </>
  );
}
