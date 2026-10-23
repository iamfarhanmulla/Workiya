"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import useRecordList from "@/hooks/useRecordList";
import { ALL_FILTERS, filterEmployees, statusChange } from "./employeeForm";

// Status toggle and delete-with-confirm for a row; both reload the list on success.
function useRowActions(employees, showToast) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function toggleActive(employee) {
    const change = statusChange(employee);
    try {
      await api.patch(`/employees/${employee.Id}/status`, change.body);
      showToast(change.message, change.type);
      employees.reload();
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/employees/${deleteTarget}`);
      showToast("Employee deleted successfully!", "success");
      employees.reload();
    } catch {
      showToast("Failed to delete employee.", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  return {
    toggleActive,
    deleteTarget,
    askDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
  };
}

// Everything the Employees page holds: the lists, filters, open dialogs and row actions.
export default function useEmployeesPage() {
  const employees = useRecordList("/employees");
  const companies = useRecordList("/users/companies", { optional: true });
  const managers = useRecordList("/employees/managers-list", { optional: true });
  const { toasts, showToast } = useToast();
  const [filters, setFilters] = useState(ALL_FILTERS);
  // null = closed; { employee: null } = add; { employee } = edit.
  const [dialog, setDialog] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const rowActions = useRowActions(employees, showToast);

  function saved(message) {
    setDialog(null);
    showToast(message);
    employees.reload();
  }

  return {
    ...rowActions,
    employees,
    companies: companies.items,
    managers: managers.items,
    toasts,
    showToast,
    filters,
    setFilter: (key) => (value) => setFilters((f) => ({ ...f, [key]: value })),
    shown: filterEmployees(employees.items, filters),
    dialog,
    openAdd: () => setDialog({ employee: null }),
    openEdit: (employee) => {
      setViewTarget(null);
      setDialog({ employee });
    },
    closeDialog: () => setDialog(null),
    saved,
    viewTarget,
    openView: setViewTarget,
    closeView: () => setViewTarget(null),
  };
}
