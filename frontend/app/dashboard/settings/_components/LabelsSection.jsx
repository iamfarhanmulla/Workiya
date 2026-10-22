"use client";

import { useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";
import { useTerminology } from "@/hooks/useTerminology";
import { SectionTitle, TextField } from "./FormBits";
import { TERM_KEYS, getTerminology, saveTerminology } from "./settingsApi";

const KEY_LABELS = {
  "account.singular": "Account (one)",
  "account.plural": "Accounts (many)",
  "activity.singular": "Activity (one)",
  "activity.plural": "Activities (many)",
  "submission.singular": "Submission (one)",
  "submission.plural": "Submissions (many)",
};

function pickLabels(source) {
  return Object.fromEntries(TERM_KEYS.map((key) => [key, source?.[key] || ""]));
}

function useCompanyLabels(companyId, notify) {
  const [labels, setLabels] = useState(() => pickLabels(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getTerminology(companyId)
      .then((data) => {
        if (active) setLabels(pickLabels(data));
      })
      .catch((err) => notify(getErrorMessage(err, "Failed to load labels."), "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [companyId, notify]);

  return { labels, setLabels, loading };
}

function LabelInputs({ labels, disabled, onChange }) {
  return (
    <div className="form-row form-row-2">
      {TERM_KEYS.map((key) => (
        <TextField
          key={key}
          id={`stg-term-${key.replace(".", "-")}`}
          label={KEY_LABELS[key]}
          value={labels[key]}
          disabled={disabled}
          onChange={(v) => onChange({ ...labels, [key]: v })}
        />
      ))}
    </div>
  );
}

export default function LabelsSection({ companyId, notify }) {
  const { reload } = useTerminology();
  const { labels, setLabels, loading } = useCompanyLabels(companyId, notify);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const trimmed = Object.fromEntries(TERM_KEYS.map((key) => [key, labels[key].trim()]));
    if (Object.values(trimmed).some((v) => !v || v.length > 100)) {
      notify("Every label is required (up to 100 characters).", "warning");
      return;
    }
    setSaving(true);
    try {
      await saveTerminology(trimmed, companyId);
      setLabels(trimmed);
      reload();
      notify("Labels saved.", "success");
    } catch (err) {
      notify(getErrorMessage(err, "Failed to save labels."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stg-section" style={{ "--stg-du": "0.2s" }}>
      <SectionTitle icon="translate" color="#1E3A8A">Labels</SectionTitle>
      <p className="stg-row-desc" style={{ marginBottom: 12 }}>
        The words used for accounts, visits and reports across the app.
      </p>
      <LabelInputs labels={labels} disabled={loading} onChange={setLabels} />
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={saving || loading}
        >
          <span className="material-symbols-outlined" aria-hidden="true">save</span>
          {saving ? "Saving..." : "Save Labels"}
        </button>
      </div>
    </div>
  );
}
