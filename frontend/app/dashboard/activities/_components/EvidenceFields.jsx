"use client";

import { isSafeUrl } from "@/lib/safeUrl";

const REQUIRED = <span className="wk-req" aria-hidden="true">*</span>;

// The evidence an activity type asks for: a photo (minPhotos > 0) and/or a signature.
export function evidenceNeeds(activityType) {
  return {
    photo: (activityType?.minPhotos ?? 0) > 0,
    signature: Boolean(activityType?.requiresSignature),
  };
}

function urlProblem(value, label, required) {
  const url = value.trim();
  if (!url) return required ? `${label} is required for this visit type.` : null;
  return isSafeUrl(url) ? null : `${label} must be an http(s) URL or a /path.`;
}

// Mirrors the API checks so the rep sees the problem before submitting.
export function evidenceProblem(activityType, report) {
  const needs = evidenceNeeds(activityType);
  return urlProblem(report.photoUrl, "Photo URL", needs.photo)
    || urlProblem(report.signatureUrl, "Signature URL", needs.signature);
}

// Both inputs are shown only when required, so each carries the required marker.
function UrlInput({
  id, label, value, onChange,
}) {
  return (
    <div className="wk-field">
      <label htmlFor={id} className="wk-label">
        {label}
        {REQUIRED}
      </label>
      <input
        id={id}
        className="wk-input"
        type="url"
        maxLength={500}
        placeholder="https://..."
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

// Photo and signature links, shown only when the activity type requires them.
export default function EvidenceFields({ activityType, report, setReport }) {
  const needs = evidenceNeeds(activityType);
  const set = (key) => (e) => setReport((prev) => ({ ...prev, [key]: e.target.value }));
  return (
    <>
      {needs.photo && (
        <UrlInput
          id="report-photo"
          label="Photo URL"
          value={report.photoUrl}
          onChange={set("photoUrl")}
        />
      )}
      {needs.signature && (
        <UrlInput
          id="report-signature"
          label="Signature URL"
          value={report.signatureUrl}
          onChange={set("signatureUrl")}
        />
      )}
    </>
  );
}
