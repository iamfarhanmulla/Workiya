"use client";

import { useState } from "react";
import ModalShell from "./ModalShell";
import SubmissionDetails from "./SubmissionDetails";
import { usePendingReviews } from "./useActivitiesData";
import { fmtDateTime } from "./activityConfig";

const MUTED = { fontSize: 12, color: "var(--ds-text-2)" };

function ReviewRow({ submission, onOpen }) {
  return (
    <tr>
      <td style={{ fontWeight: 600, fontSize: 13 }}>{submission.activityTitle || "—"}</td>
      <td style={{ fontSize: 13 }}>{submission.accountName || "—"}</td>
      <td style={{ fontSize: 12 }}>{submission.submittedByName || "—"}</td>
      <td style={MUTED}>{fmtDateTime(submission.submittedAtUtc)}</td>
      <td>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => onOpen(submission)}>
          Review
        </button>
      </td>
    </tr>
  );
}

function ReviewTable({
  items, loading, labels, onOpen,
}) {
  const empty = loading
    ? "Loading..."
    : `No ${labels.submissions.toLowerCase()} waiting for review.`;
  return (
    <div className="table-card" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>{labels.activity}</th>
            <th>{labels.account}</th>
            <th>Submitted by</th>
            <th>Submitted</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => <ReviewRow key={s.id} submission={s} onOpen={onOpen} />)}
          {items.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="page-placeholder" style={{ minHeight: 140 }}><p>{empty}</p></div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Staff queue of reports waiting for approval (GET /submissions?reviewStatus=Pending).
export default function PendingReviews({ labels, onReviewed, showToast }) {
  const { items, loading, reload } = usePendingReviews();
  const [open, setOpen] = useState(null);
  const handleReviewed = (message) => {
    setOpen(null);
    reload();
    onReviewed(message);
  };

  return (
    <div style={{ margin: "0 20px 20px" }}>
      <ReviewTable items={items} loading={loading} labels={labels} onOpen={setOpen} />
      {open && (
        <ModalShell
          icon="rate_review"
          title={open.activityTitle || labels.submission}
          sub={open.accountName}
          onClose={() => setOpen(null)}
        >
          <SubmissionDetails
            submissionId={open.id}
            title={labels.submission}
            isStaff
            onReviewed={handleReviewed}
            showToast={showToast}
          />
        </ModalShell>
      )}
    </div>
  );
}
