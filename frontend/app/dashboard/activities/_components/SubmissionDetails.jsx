"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import CustomFieldValues from "@/components/CustomFieldValues";
import { useCustomFields } from "@/hooks/useCustomFields";
import { isSafeUrl } from "@/lib/safeUrl";
import { REVIEW_STATUS, StatusPill } from "@/components/status";
import DetailRow, { SectionTitle } from "./DetailRow";
import { fmtDateTime } from "./activityConfig";

function coords(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

function FileLink({ url, label }) {
  if (!isSafeUrl(url)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}

function ReviewActions({ submission, onReviewed, showToast }) {
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function review(status) {
    setBusy(true);
    try {
      await api.patch(`/submissions/${submission.id}/review`, {
        status, comment: comment.trim() || null,
      });
      onReviewed(status === "Approved" ? "Report approved." : "Report rejected.");
    } catch (err) {
      showToast(getErrorMessage(err, "Review failed."), "error");
      setBusy(false);
    }
  }

  return (
    <div className="wk-field">
      <label htmlFor="review-comment" className="wk-label">Review comment</label>
      <textarea
        id="review-comment"
        className="wk-textarea"
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="wk-actions">
        <button
          type="button"
          className="wk-btn wk-btn--primary"
          disabled={busy}
          onClick={() => review("Approved")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">check</span>
          Approve
        </button>
        <button
          type="button"
          className="wk-btn wk-btn--danger-soft"
          disabled={busy}
          onClick={() => review("Rejected")}
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
          Reject
        </button>
      </div>
    </div>
  );
}

function SubmissionBody({ submission, fields }) {
  return (
    <>
      <div><StatusPill status={submission.reviewStatus} map={REVIEW_STATUS} /></div>
      <DetailRow icon="person" label="Submitted by" value={submission.submittedByName} />
      <DetailRow icon="schedule" label="Submitted" value={fmtDateTime(submission.submittedAtUtc)} />
      <DetailRow icon="login" label="Check-in" value={fmtDateTime(submission.checkInAtUtc)} />
      <DetailRow
        icon="my_location"
        label="Check-in location"
        value={coords(submission.checkInLatitude, submission.checkInLongitude)}
      />
      <DetailRow icon="logout" label="Check-out" value={fmtDateTime(submission.checkOutAtUtc)} />
      <DetailRow
        icon="location_on"
        label="Check-out location"
        value={coords(submission.checkOutLatitude, submission.checkOutLongitude)}
      />
      <DetailRow
        icon="star"
        label="Rating"
        value={submission.rating ? `${submission.rating} / 5` : null}
      />
      <DetailRow icon="notes" label="Notes" value={submission.notes} />
      <div className="wk-actions">
        <FileLink url={submission.photoUrl} label="View photo" />
        <FileLink url={submission.signatureUrl} label="View signature" />
      </div>
      {fields.length > 0 && (
        <CustomFieldValues fields={fields} values={submission.answers || {}} />
      )}
      <DetailRow icon="rate_review" label="Review comment" value={submission.reviewComment} />
      <DetailRow icon="how_to_reg" label="Reviewed by" value={submission.reviewedByName} />
    </>
  );
}

export default function SubmissionDetails({
  submissionId, title, isStaff, onReviewed, showToast,
}) {
  const [result, setResult] = useState({ id: null, submission: null, failed: false });
  // A SUPER_ADMIN reads the custom fields of the submission's company.
  const { fields } = useCustomFields("SUBMISSION", result.submission?.companyId);

  useEffect(() => {
    let cancelled = false;
    api.get(`/submissions/${submissionId}`)
      .then((res) => {
        if (!cancelled) setResult({ id: submissionId, submission: res.data?.data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ id: submissionId, submission: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  const { submission, failed } = result;
  const loading = result.id !== submissionId;
  return (
    <div className="wk-detail-section">
      <SectionTitle>{title}</SectionTitle>
      {loading && <p className="wk-muted">Loading…</p>}
      {!loading && failed && <p className="wk-error-text">Could not load the report.</p>}
      {!loading && submission && <SubmissionBody submission={submission} fields={fields || []} />}
      {!loading && submission && isStaff && submission.reviewStatus === "Pending" && (
        <ReviewActions submission={submission} onReviewed={onReviewed} showToast={showToast} />
      )}
    </div>
  );
}
