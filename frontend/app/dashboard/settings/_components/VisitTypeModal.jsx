"use client";

import { useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";
import SettingsModal from "./SettingsModal";
import { CheckboxField, TextField } from "./FormBits";
import { saveActivityType, toUpperSnake } from "./settingsApi";

// A report carries one photo link and there is no customer OTP flow yet, so the API accepts
// at most one photo and no OTP rule; the form offers only what can be met.
const MAX_MIN_PHOTOS = 1;

function buildForm(type) {
  return {
    name: type?.name || "",
    code: type?.code || "",
    requiresCheckIn: type ? !!type.requiresCheckIn : true,
    geofenceMeters: type?.geofenceMeters == null ? "" : String(type.geofenceMeters),
    minPhotos: String(type?.minPhotos ?? 0),
    requiresSignature: !!type?.requiresSignature,
    isActive: type ? !!type.isActive : true,
  };
}

function validate(form) {
  if (!form.name.trim()) return "Name is required.";
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(form.code)) {
    return "Code: 1-50 letters, digits, hyphens or underscores.";
  }
  const geo = form.geofenceMeters.trim();
  if (geo && (!/^\d+$/.test(geo) || Number(geo) < 10 || Number(geo) > 5000)) {
    return "Geofence must be between 10 and 5000 metres, or empty for no limit.";
  }
  if (!/^\d+$/.test(form.minPhotos) || Number(form.minPhotos) > MAX_MIN_PHOTOS) {
    return `Minimum photos must be 0 or ${MAX_MIN_PHOTOS}.`;
  }
  return null;
}

function toBody(form) {
  const geo = form.geofenceMeters.trim();
  return {
    name: form.name.trim(),
    code: form.code,
    requiresCheckIn: form.requiresCheckIn,
    geofenceMeters: geo ? Number(geo) : null,
    minPhotos: Number(form.minPhotos),
    requiresSignature: form.requiresSignature,
    requiresCustomerOtp: false,
    isActive: form.isActive,
  };
}

const FLAGS = [
  ["requiresCheckIn", "Requires check-in"],
  ["requiresSignature", "Requires signature"],
  ["isActive", "Active"],
];

function TypeForm({ form, set }) {
  return (
    <>
      <div className="form-row form-row-2">
        <TextField id="vt-name" label="Name" required value={form.name} onChange={set("name")} />
        <TextField id="vt-code" label="Code" required value={form.code} onChange={set("code")} />
      </div>
      <div className="form-row form-row-2">
        <TextField
          id="vt-geofence"
          label="Geofence (metres, empty = off)"
          type="number"
          value={form.geofenceMeters}
          onChange={set("geofenceMeters")}
        />
        <TextField
          id="vt-photos"
          label="Minimum photos (0-1)"
          type="number"
          value={form.minPhotos}
          onChange={set("minPhotos")}
        />
      </div>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16, marginTop: 6,
      }}
      >
        {FLAGS.map(([key, label]) => (
          <CheckboxField
            key={key}
            id={`vt-${key}`}
            label={label}
            checked={form[key]}
            onChange={set(key)}
          />
        ))}
      </div>
    </>
  );
}

export default function VisitTypeModal({
  type, companyId, notify, onClose, onSaved,
}) {
  const isEdit = !!type;
  const [form, setForm] = useState(() => buildForm(type));
  const [codeTouched, setCodeTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const set = (name) => (value) => {
    if (name === "code") setCodeTouched(true);
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "name" && !codeTouched) next.code = toUpperSnake(value);
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
      await saveActivityType(type?.id, toBody(form), companyId);
      notify(isEdit ? "Visit type updated." : "Visit type created.", "success");
      onSaved();
    } catch (err) {
      notify(getErrorMessage(err, "Failed to save the visit type."), "error");
      setSaving(false);
    }
  };

  return (
    <SettingsModal
      title={isEdit ? "Edit Visit Type" : "Add Visit Type"}
      sub="Rules a rep must meet when submitting this kind of visit"
      icon="assignment_turned_in"
      saving={saving}
      onClose={onClose}
      onSave={handleSave}
    >
      <TypeForm form={form} set={set} />
    </SettingsModal>
  );
}
