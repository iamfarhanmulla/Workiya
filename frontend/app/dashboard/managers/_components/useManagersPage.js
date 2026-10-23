"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import useRecordList from "@/hooks/useRecordList";
import { ALL_FILTERS, filterManagers } from "./managerForm";

// Everything the Managers page holds: lists, filters, open dialog, status and delete flows.
export default function useManagersPage() {
  const managers = useRecordList("/managers");
  const companies = useRecordList("/users/companies", { optional: true });
  const { toasts, showToast } = useToast();
  const [filters, setFilters] = useState(ALL_FILTERS);
  // null = closed; { kind: "form", manager } (manager null = add) | { kind: "view", manager }.
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function toggleActive(m) {
    try {
      await api.patch(`/managers/${m.Id}/status`, { isActive: m.IsActive ? 0 : 1 });
      showToast(
        m.IsActive ? "Manager deactivated." : "Manager activated.",
        m.IsActive ? "warning" : "success",
      );
      managers.reload();
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/managers/${deleteTarget}`);
      showToast("Manager deleted successfully!", "success");
      managers.reload();
    } catch {
      showToast("Failed to delete manager.", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  function saved(message) {
    setDialog(null);
    showToast(message);
    managers.reload();
  }

  return {
    managers,
    companies: companies.items,
    toasts,
    showToast,
    filters,
    setFilter: (key) => (value) => setFilters((f) => ({ ...f, [key]: value })),
    shown: filterManagers(managers.items, filters),
    dialog,
    openAdd: () => setDialog({ kind: "form", manager: null }),
    closeDialog: () => setDialog(null),
    saved,
    handlers: {
      onView: (manager) => setDialog({ kind: "view", manager }),
      onEdit: (manager) => setDialog({ kind: "form", manager }),
      onToggle: toggleActive,
      onDelete: setDeleteTarget,
    },
    deleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
  };
}
