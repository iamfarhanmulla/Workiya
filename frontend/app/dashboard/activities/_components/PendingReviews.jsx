"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { SkeletonRows } from "@/components/DataStates";
import SubmissionDetails from "./SubmissionDetails";
import { usePendingReviews } from "./useActivitiesData";
import { fmtDateTime } from "./activityConfig";

function ReviewRow({ submission, onOpen }) {
  return (
    <tr>
      <td className="is-primary">{submission.activityTitle || "—"}</td>
      <td>{submission.accountName || "—"}</td>
      <td>{submission.submittedByName || "—"}</td>
      <td>{fmtDateTime(submission.submittedAtUtc)}</td>
      <td className="col-actions">
        <button
          type="button"
          className="wk-btn wk-btn--secondary wk-btn--sm"
          onClick={() => onOpen(submission)}
        >
          Review
        </button>
      </td>
    </tr>
  );
}

function ReviewTable({ items, labels, onOpen }) {
  if (!items.length) {
    return (
      <div className="wk-empty">
        <div className="wk-empty-title">All caught up</div>
        <div className="wk-empty-text">
          {`No ${labels.submissions.toLowerCase()} waiting for review.`}
        </div>
      </div>
    );
  }
  return (
    <div className="wk-table-wrap" style={{ borderTop: 0 }}>
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">{labels.activity}</th>
            <th scope="col">{labels.account}</th>
            <th scope="col">Submitted by</th>
            <th scope="col">Submitted</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => <ReviewRow key={s.id} submission={s} onOpen={onOpen} />)}
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
    <section className="wk-card wk-results" aria-label="Pending review">
      {loading
        ? <SkeletonRows rows={4} />
        : <ReviewTable items={items} labels={labels} onOpen={setOpen} />}
      {open && (
        <Modal
          icon="rate_review"
          labelId="review-title"
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
        </Modal>
      )}
    </section>
  );
}
