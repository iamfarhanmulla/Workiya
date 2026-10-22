"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import CustomFieldValues from "@/components/CustomFieldValues";
import { useCustomFields } from "@/hooks/useCustomFields";
import { isSafeUrl } from "@/lib/safeUrl";
import DetailRow, { SectionTitle } from "./DetailRow";
import { PILL, REVIEW_STYLE, fmtDateTime } from "./activityConfig";

const LINK = { fontSize: 13, color: "#6366F1" };
const MUTED = { fontSize: 12, color: "var(--ds-text-2)" };
const ERROR = { fontSize: 12, color: "#EF4444" };

function coords(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return null;
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

function FileLink({ url, label }) {
  if (!isSafeUrl(url)) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={LINK}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label htmlFor="review-comment" className="form-label">Review comment</label>
      <textarea
        id="review-comment"
        className="form-textarea"
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() => review("Approved")}
        >
          <span className="material-symbols-outlined">check</span>
          Approve
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          disabled={busy}
          onClick={() => review("Rejected")}
        >
          <span className="material-symbols-outlined">close</span>
          Reject
        </button>
      </div>
    </div>
  );
}

function SubmissionBody({ submission, fields }) {
  const review = REVIEW_STYLE[submission.reviewStatus] || REVIEW_STYLE.Pending;
  return (
    <>
      <div>
        <span style={{ ...PILL, background: review.bg, color: review.color }}>
          {submission.reviewStatus}
        </span>
      </div>
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
      <div style={{ display: "flex", gap: 16 }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <SectionTitle>{title}</SectionTitle>
      {loading && <p style={MUTED}>Loading...</p>}
      {!loading && failed && <p style={ERROR}>Could not load the report.</p>}
      {!loading && submission && <SubmissionBody submission={submission} fields={fields || []} />}
      {!loading && submission && isStaff && submission.reviewStatus === "Pending" && (
        <ReviewActions submission={submission} onReviewed={onReviewed} showToast={showToast} />
      )}
    </div>
  );
}
