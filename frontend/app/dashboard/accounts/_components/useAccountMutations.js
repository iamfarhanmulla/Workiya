"use client";

import { api, getErrorMessage } from "@/lib/apiClient";

// Status toggle and soft delete, each followed by a toast and a list reload.
export default function useAccountMutations({ singular, showToast, reload }) {
  async function toggleActive(account) {
    try {
      await api.patch(`/accounts/${account.id}/status`, { isActive: !account.isActive });
      showToast(`${singular} ${account.isActive ? "deactivated" : "activated"}.`, "success");
      reload();
    } catch (err) {
      showToast(getErrorMessage(err, "Update failed."), "error");
    }
  }

  async function remove(account) {
    try {
      await api.delete(`/accounts/${account.id}`);
      showToast(`${singular} deleted.`, "success");
      reload();
      return true;
    } catch (err) {
      showToast(getErrorMessage(err, "Delete failed."), "error");
      return false;
    }
  }

  return { toggleActive, remove };
}
