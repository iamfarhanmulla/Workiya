"use client";

import { ConfirmModal } from "@/components/ConfirmModal";
import ActivityFormModal from "./ActivityFormModal";
import ActivityViewModal from "./ActivityViewModal";
import SubmitReportModal from "./SubmitReportModal";
import { canSubmitReport, statusMoves } from "./activityConfig";

function OpenModal({
  actions, labels, user, isStaff, pickers, showToast,
}) {
  const { kind, activity } = actions.modal;
  if (kind === "form") {
    return (
      <ActivityFormModal
        activity={activity}
        accounts={pickers.accounts}
        employees={pickers.employees}
        labels={labels}
        onClose={actions.closeModal}
        onSaved={actions.finish}
        showToast={showToast}
      />
    );
  }
  if (kind === "report") {
    return (
      <SubmitReportModal
        activity={activity}
        labels={labels}
        onClose={actions.closeModal}
        onSubmitted={actions.finish}
        showToast={showToast}
      />
    );
  }
  return (
    <ActivityViewModal
      activity={activity}
      labels={labels}
      isStaff={isStaff}
      moves={statusMoves(activity, user, isStaff)}
      canSubmit={canSubmitReport(activity, user)}
      onMove={(status) => actions.changeStatus(activity, status)}
      onEdit={() => actions.openEdit(activity)}
      onSubmitReport={() => actions.openReport(activity)}
      onReviewed={actions.finish}
      onClose={actions.closeModal}
      showToast={showToast}
    />
  );
}

// The delete confirmation plus whichever modal `actions.modal` names:
// create/edit form, view panel or report form.
export default function ActivityModals({ pickers, ctx }) {
  const {
    actions, labels, user, isStaff, showToast,
  } = ctx;
  return (
    <>
      <ConfirmModal
        open={!!actions.deleteTarget}
        title={`Delete ${labels.activity}`}
        message={`This will remove "${actions.deleteTarget?.title || ""}".`}
        onConfirm={actions.confirmDelete}
        onCancel={actions.cancelDelete}
      />
      {actions.modal && (
        <OpenModal
          actions={actions}
          labels={labels}
          user={user}
          isStaff={isStaff}
          pickers={pickers}
          showToast={showToast}
        />
      )}
    </>
  );
}
