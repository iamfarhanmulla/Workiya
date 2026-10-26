"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import { ACTIVITY_STATUS } from "@/components/status";

// Page-level UI state (which modal is open, what is being deleted) and the
// status/delete calls that do not need a form of their own.
export default function useActivityActions({ labels, showToast, reload }) {
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function finish(message) {
    showToast(message, "success");
    setModal(null);
    reload();
  }

  async function changeStatus(activity, status) {
    try {
      await api.patch(`/activities/${activity.id}/status`, { status });
      finish(`${labels.activity} moved to ${ACTIVITY_STATUS[status].label.toLowerCase()}.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Update failed."), "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/activities/${deleteTarget.id}`);
      setDeleteTarget(null);
      finish(`${labels.activity} deleted.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Delete failed."), "error");
    }
  }

  return {
    modal,
    deleteTarget,
    finish,
    changeStatus,
    confirmDelete,
    openAdd: () => setModal({ kind: "form", activity: null }),
    openEdit: (activity) => setModal({ kind: "form", activity }),
    openView: (activity) => setModal({ kind: "view", activity }),
    openReport: (activity) => setModal({ kind: "report", activity }),
    closeModal: () => setModal(null),
    askDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
  };
}
