"use client";

import { useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";
import SettingsModal from "./SettingsModal";
import { CheckboxField, TextField } from "./FormBits";
import {
  DATA_TYPES, OPTION_TYPES, parseOptions, saveCustomField, toCamelKey,
} from "./settingsApi";

function buildForm(field) {
  return {
    label: field?.label || "",
    fieldKey: field?.fieldKey || "",
    dataType: field?.dataType || "TEXT",
    optionsText: (field?.options || []).join(", "),
    isRequired: !!field?.isRequired,
    sortOrder: String(field?.sortOrder ?? 0),
    isActive: field ? !!field.isActive : true,
  };
}

function validate(form) {
  if (!form.label.trim()) return "Label is required.";
  if (!/^[a-zA-Z0-9_]{1,50}$/.test(form.fieldKey)) {
    return "Field key: 1-50 letters, digits or underscores.";
  }
  if (OPTION_TYPES.includes(form.dataType) && parseOptions(form.optionsText).length === 0) {
    return "Add at least one option.";
  }
  if (!/^\d+$/.test(form.sortOrder)) return "Sort order must be a whole number.";
  return null;
}

function toBody(form, isEdit, entityType) {
  const common = {
    label: form.label.trim(),
    isRequired: form.isRequired,
    options: OPTION_TYPES.includes(form.dataType) ? parseOptions(form.optionsText) : null,
    sortOrder: Number(form.sortOrder),
    isActive: form.isActive,
  };
  if (isEdit) return common;
  return {
    entityType, fieldKey: form.fieldKey, dataType: form.dataType, ...common,
  };
}

function TypeSelect({ value, disabled, onChange }) {
  return (
    <div className="form-group">
      <label htmlFor="cf-type" className="form-label">Data type</label>
      <select
        id="cf-type"
        className="form-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {DATA_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  );
}

function FieldFlags({ form, set }) {
  return (
    <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
      <CheckboxField
        id="cf-required"
        label="Required"
        checked={form.isRequired}
        onChange={set("isRequired")}
      />
      <CheckboxField
        id="cf-active"
        label="Active"
        checked={form.isActive}
        onChange={set("isActive")}
      />
    </div>
  );
}

function FieldForm({ form, isEdit, set }) {
  return (
    <>
      <div className="form-row form-row-2">
        <TextField
          id="cf-label"
          label="Label"
          required
          value={form.label}
          onChange={set("label")}
        />
        <TextField
          id="cf-key"
          label="Field key"
          required
          value={form.fieldKey}
          disabled={isEdit}
          onChange={set("fieldKey")}
        />
      </div>
      <div className="form-row form-row-2">
        <TypeSelect value={form.dataType} disabled={isEdit} onChange={set("dataType")} />
        <TextField
          id="cf-sort"
          label="Sort order"
          type="number"
          value={form.sortOrder}
          onChange={set("sortOrder")}
        />
      </div>
      {OPTION_TYPES.includes(form.dataType) && (
        <TextField
          id="cf-options"
          label="Options (comma-separated)"
          required
          placeholder="Option A, Option B"
          value={form.optionsText}
          onChange={set("optionsText")}
        />
      )}
      <FieldFlags form={form} set={set} />
    </>
  );
}

export default function CustomFieldModal({
  entityType, field, companyId, title, notify, onClose, onSaved,
}) {
  const isEdit = !!field;
  const [form, setForm] = useState(() => buildForm(field));
  const [keyTouched, setKeyTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const set = (name) => (value) => {
    if (name === "fieldKey") setKeyTouched(true);
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "label" && !keyTouched) next.fieldKey = toCamelKey(value);
      return next;
    });
  };

  const handleSave = async () => {
    const problem = validate(form);
    if (problem) {
      notify(problem, "warning");
      return;
    }
    setSaving(true);
    try {
      await saveCustomField(field?.id, toBody(form, isEdit, entityType), companyId);
      notify(isEdit ? "Field updated." : "Field created.", "success");
      onSaved();
    } catch (err) {
      notify(getErrorMessage(err, "Failed to save the field."), "error");
      setSaving(false);
    }
  };

  return (
    <SettingsModal
      title={isEdit ? `Edit ${title}` : `Add ${title}`}
      sub="Key and data type cannot change after the field is created"
      icon="tune"
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <FieldForm form={form} isEdit={isEdit} set={set} />
    </SettingsModal>
  );
}
