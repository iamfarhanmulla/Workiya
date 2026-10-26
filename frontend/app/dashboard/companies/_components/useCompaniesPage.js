"use client";

import { useState } from "react";
import { api } from "@/lib/apiClient";
import { useToast } from "@/components/Toast";
import useRecordList from "@/hooks/useRecordList";
import { ALL_FILTERS, filterCompanies, statusBody } from "./companyForm";

// Row actions that call the API straight away: activate/deactivate and delete.
function useCompanyActions(companies, showToast) {
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function toggleStatus(company) {
    try {
      await api.patch(`/companies/${company.Id}/status`, statusBody(company));
      showToast(
        company.IsActive ? "Company deactivated." : "Company activated.",
        company.IsActive ? "warning" : "success",
      );
      companies.reload();
    } catch {
      showToast("Failed to update status.", "error");
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/companies/${deleteTarget}`);
      showToast("Company deleted successfully!", "success");
      companies.reload();
    } catch {
      showToast("Failed to delete company.", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  return {
    toggleStatus,
    deleteTarget,
    askDelete: setDeleteTarget,
    cancelDelete: () => setDeleteTarget(null),
    confirmDelete,
  };
}

// Everything the Companies page holds: the list, filters, open dialogs and row actions.
export default function useCompaniesPage() {
  const companies = useRecordList("/companies");
  const { toasts, showToast } = useToast();
  const [filters, setFilters] = useState(ALL_FILTERS);
  // null = closed; { company: null } = add; { company } = edit.
  const [dialog, setDialog] = useState(null);
  const [viewing, setViewing] = useState(null);
  const actions = useCompanyActions(companies, showToast);

  function saved(message) {
    setDialog(null);
    showToast(message);
    companies.reload();
  }

  return {
    ...actions,
    companies,
    toasts,
    showToast,
    filters,
    setFilter: (key) => (value) => setFilters((f) => ({ ...f, [key]: value })),
    shown: filterCompanies(companies.items, filters),
    dialog,
    openAdd: () => setDialog({ company: null }),
    openEdit: (company) => setDialog({ company }),
    closeDialog: () => setDialog(null),
    saved,
    viewing,
    openView: setViewing,
    closeView: () => setViewing(null),
    editFromView: () => {
      setDialog({ company: viewing });
      setViewing(null);
    },
  };
}
