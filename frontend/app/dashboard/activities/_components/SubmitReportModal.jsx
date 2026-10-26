"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import CustomFieldInputs from "@/components/CustomFieldInputs";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import { useCustomFields } from "@/hooks/useCustomFields";
import Modal from "@/components/Modal";
import EvidenceFields, { evidenceProblem } from "./EvidenceFields";
import useGeoCheckIn from "./useGeoCheckIn";
import { fmtDateTime } from "./activityConfig";

function LocationPicker({ geo }) {
  const { checkIn } = geo;
  return (
    <div className="wk-field">
      <span className="wk-label">Check-in</span>
      <div className="wk-actions">
        <button
          type="button"
          className="wk-btn wk-btn--secondary"
          onClick={geo.locate}
          disabled={geo.locating}
        >
          <span className="material-symbols-outlined" aria-hidden="true">my_location</span>
          {geo.locating ? "Locating…" : "Use my location"}
        </button>
        {checkIn && (
          <span className="wk-muted">
            {`${checkIn.latitude.toFixed(6)}, ${checkIn.longitude.toFixed(6)}`}
            {` at ${fmtDateTime(checkIn.at)}`}
          </span>
        )}
      </div>
      {geo.error && <p role="alert" className="wk-error-text">{geo.error}</p>}
    </div>
  );
}

function ReportFields({ report, setReport, fields }) {
  const set = (key) => (e) => setReport((prev) => ({ ...prev, [key]: e.target.value }));
  return (
    <>
      <div className="wk-field">
        <label htmlFor="report-notes" className="wk-label">Notes</label>
        <textarea
          id="report-notes"
          className="wk-textarea"
          rows={3}
          maxLength={3000}
          value={report.notes}
          onChange={set("notes")}
        />
      </div>
      <div className="wk-field">
        <label htmlFor="report-rating" className="wk-label">Rating</label>
        <select
          id="report-rating"
          className="wk-select"
          value={report.rating}
          onChange={set("rating")}
        >
          <option value="">— No rating —</option>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={String(n)}>{n}</option>)}
        </select>
      </div>
      <CustomFieldInputs
        fields={fields}
        values={report.answers}
        onChange={(answers) => setReport((prev) => ({ ...prev, answers }))}
        idPrefix="report"
      />
    </>
  );
}

const BLANK_REPORT = {
  notes: "", rating: "", answers: {}, photoUrl: "", signatureUrl: "",
};

function toBody(report, checkIn) {
  const body = {
    notes: report.notes.trim() || null,
    rating: report.rating ? Number(report.rating) : null,
    answers: report.answers,
    photoUrl: report.photoUrl.trim() || null,
    signatureUrl: report.signatureUrl.trim() || null,
  };
  if (checkIn) {
    body.checkInAtUtc = checkIn.at;
    body.checkInLatitude = checkIn.latitude;
    body.checkInLongitude = checkIn.longitude;
    body.checkOutAtUtc = new Date().toISOString();
  }
  return body;
}

// The client-side version of the type's rules: check-in, photo and signature.
function reportProblem(activityType, report, checkIn) {
  if (activityType?.requiresCheckIn && !checkIn) {
    return "This visit needs a check-in. Use your location first.";
  }
  return evidenceProblem(activityType, report);
}

export default function SubmitReportModal({
  activity, labels, onClose, onSubmitted, showToast,
}) {
  const { fields } = useCustomFields("SUBMISSION", activity.companyId);
  const { types } = useActivityTypes(activity.companyId);
  const activityType = types.find((t) => t.id === activity.activityTypeId);
  const geo = useGeoCheckIn();
  const [report, setReport] = useState(BLANK_REPORT);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const problem = reportProblem(activityType, report, geo.checkIn);
    if (problem) {
      showToast(problem, "warning");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/activities/${activity.id}/submissions`, toBody(report, geo.checkIn));
      onSubmitted(`${labels.submission} submitted.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Submit failed."), "error");
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onClose}>Cancel</button>
      <button type="button" className="wk-btn wk-btn--primary" onClick={submit} disabled={saving}>
        <span className="material-symbols-outlined" aria-hidden="true">send</span>
        {saving ? "Submitting…" : "Submit"}
      </button>
    </>
  );
  return (
    <Modal
      icon="task_alt"
      labelId="report-title"
      title={`Submit ${labels.submission.toLowerCase()}`}
      sub={activity.title}
      onClose={onClose}
      footer={footer}
    >
      <LocationPicker geo={geo} />
      <EvidenceFields activityType={activityType} report={report} setReport={setReport} />
      <ReportFields report={report} setReport={setReport} fields={fields || []} />
    </Modal>
  );
}
