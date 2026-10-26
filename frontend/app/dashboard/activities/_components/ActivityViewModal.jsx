"use client";

import Modal from "@/components/Modal";
import { PriorityTag, StatusPill } from "@/components/status";
import DetailRow, { SectionTitle } from "./DetailRow";
import StatusMoveButtons from "./StatusMoveButtons";
import SubmissionDetails from "./SubmissionDetails";
import { fmtDate, fmtDateTime } from "./activityConfig";

function Footer({
  isStaff, canSubmit, onClose, onEdit, onSubmitReport,
}) {
  return (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onClose}>Close</button>
      {isStaff && (
        <button type="button" className="wk-btn wk-btn--secondary" onClick={onEdit}>
          <span className="material-symbols-outlined" aria-hidden="true">edit</span>
          Edit
        </button>
      )}
      {canSubmit && (
        <button type="button" className="wk-btn wk-btn--primary" onClick={onSubmitReport}>
          <span className="material-symbols-outlined" aria-hidden="true">task_alt</span>
          Submit report
        </button>
      )}
    </>
  );
}

function ActivityDetails({ activity, accountLabel }) {
  return (
    <>
      <div className="wk-actions">
        <StatusPill status={activity.status} />
        <PriorityTag priority={activity.priority} />
      </div>
      {activity.description && <p className="wk-detail-note">{activity.description}</p>}
      <div className="wk-detail-grid">
        <DetailRow icon="storefront" label={accountLabel} value={activity.accountName} />
        <DetailRow icon="category" label="Type" value={activity.activityTypeName} />
        <DetailRow icon="person" label="Assigned to" value={activity.assignedToName} />
        <DetailRow icon="manage_accounts" label="Assigned by" value={activity.assignedByName} />
        <DetailRow icon="event" label="Due" value={fmtDateTime(activity.dueAtUtc)} />
        <DetailRow icon="task_alt" label="Completed" value={fmtDateTime(activity.completedAtUtc)} />
        <DetailRow icon="schedule" label="Created" value={fmtDate(activity.createdAtUtc)} />
      </div>
    </>
  );
}

export default function ActivityViewModal({
  activity, labels, isStaff, moves, canSubmit, onMove, onEdit, onSubmitReport, onReviewed,
  onClose, showToast,
}) {
  const latest = activity.latestSubmission;
  const footer = (
    <Footer
      isStaff={isStaff}
      canSubmit={canSubmit}
      onClose={onClose}
      onEdit={onEdit}
      onSubmitReport={onSubmitReport}
    />
  );
  return (
    <Modal
      icon="event_note"
      labelId="activity-view-title"
      title={activity.title}
      sub={`${labels.activity} #${activity.id}`}
      onClose={onClose}
      footer={footer}
    >
      <ActivityDetails activity={activity} accountLabel={labels.account} />
      {moves.length > 0 && (
        <div className="wk-field">
          <SectionTitle>Move to</SectionTitle>
          <StatusMoveButtons moves={moves} onMove={onMove} />
        </div>
      )}
      {latest && (
        <SubmissionDetails
          submissionId={latest.id}
          title={labels.submission}
          isStaff={isStaff}
          onReviewed={onReviewed}
          showToast={showToast}
        />
      )}
    </Modal>
  );
}
