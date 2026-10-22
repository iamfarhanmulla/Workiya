"use client";

import ModalShell from "./ModalShell";
import DetailRow, { SectionTitle } from "./DetailRow";
import StatusMoveButtons from "./StatusMoveButtons";
import SubmissionDetails from "./SubmissionDetails";
import {
  COL_CFG, PILL, PRIORITY_STYLE, fmtDate, fmtDateTime,
} from "./activityConfig";

const DESCRIPTION = {
  fontSize: 13,
  color: "var(--ds-text)",
  lineHeight: 1.6,
  padding: "10px 12px",
  background: "var(--ds-surface-2, #F8FAFC)",
  borderRadius: 8,
  whiteSpace: "pre-wrap",
};

function Footer({
  isStaff, canSubmit, onClose, onEdit, onSubmitReport,
}) {
  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
      {canSubmit && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onSubmitReport}>
          <span className="material-symbols-outlined">task_alt</span>
          Submit report
        </button>
      )}
      {isStaff && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onEdit}>
          <span className="material-symbols-outlined">edit</span>
          Edit
        </button>
      )}
    </>
  );
}

function ActivityDetails({ activity, accountLabel }) {
  const cfg = COL_CFG[activity.status] || COL_CFG.Pending;
  const ps = PRIORITY_STYLE[activity.priority] || PRIORITY_STYLE.Medium;
  return (
    <>
      {activity.description && <div style={DESCRIPTION}>{activity.description}</div>}
      <DetailRow icon="medical_services" label={accountLabel} value={activity.accountName} />
      <DetailRow icon="category" label="Type" value={activity.activityTypeName} />
      <DetailRow icon="person" label="Assigned To" value={activity.assignedToName} />
      <DetailRow icon="manage_accounts" label="Assigned By" value={activity.assignedByName} />
      <DetailRow icon="event" label="Due" value={fmtDateTime(activity.dueAtUtc)} />
      <DetailRow icon="task_alt" label="Completed" value={fmtDateTime(activity.completedAtUtc)} />
      <DetailRow icon="schedule" label="Created" value={fmtDate(activity.createdAtUtc)} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...PILL, background: ps.bg, color: ps.color }}>{activity.priority}</span>
        <span style={{ ...PILL, background: cfg.countBg, color: cfg.countColor }}>{cfg.label}</span>
      </div>
    </>
  );
}

export default function ActivityViewModal({
  activity, labels, isStaff, moves, canSubmit, onMove, onEdit, onSubmitReport, onReviewed,
  onClose, showToast,
}) {
  const cfg = COL_CFG[activity.status] || COL_CFG.Pending;
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
    <ModalShell
      icon={cfg.icon}
      iconBg={cfg.countBg}
      iconColor={cfg.countColor}
      title={activity.title}
      sub={`${labels.activity} #${activity.id}`}
      maxWidth={540}
      onClose={onClose}
      footer={footer}
    >
      <ActivityDetails activity={activity} accountLabel={labels.account} />
      {moves.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
    </ModalShell>
  );
}
