"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import useRecordList from "@/hooks/useRecordList";
import { ALL_FILTERS, filterUsers, managerOptions } from "./userForm";

// Everything the Users page holds: the lists, filters, the open dialog and delete flow.
export default function useUsersPage() {
  const users = useRecordList("/users");
  const roles = useRecordList("/users/roles", { optional: true });
  const companies = useRecordList("/users/companies", { optional: true });
  const { toasts, showToast } = useToast();
  const [filters, setFilters] = useState(ALL_FILTERS);
  // null = closed; { user: null } = add; { user } = edit.
  const [dialog, setDialog] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function confirmDelete() {
    try {
      await api.delete(`/users/${deleteTarget}`);
      showToast("User deleted successfully!", "success");
      users.reload();
    } catch {
      showToast("Failed to delete user.", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  function saved(message) {
    setDialog(null);
    showToast(message);
    users.reload();
  }

  return {
    users,
    roles: roles.items,
    companies: companies.items,
    toasts,
    showToast,
    filters,
    setFilter: (key) => (value) => setFilters((f) => ({ ...f, [key]: value })),
    shown: filterUsers(users.items, filters),
    managers: managerOptions(users.items),
    dialog,
    openAdd: () => setDialog({ user: null }),
    openEdit: (user) => setDialog({ user }),
    closeDialog: () => setDialog(null),
    saved,
    deleteTarget,
    askDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
  };
}
