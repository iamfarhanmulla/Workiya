"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// Admins read /managers (inactive managers too, so they can be transfer sources). Other staff
// read the staff-accessible list of their company's active managers.
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"];

function managersUrl(callerRole) {
  return ADMIN_ROLES.includes(callerRole) ? "/managers" : "/employees/managers-list";
}

function toUser(row, roleCode) {
  const name = `${row.FirstName || ""} ${row.LastName || ""}`.trim();
  return {
    userId: row.Id,
    displayName: row.DisplayName || name || row.Name?.trim() || `User ${row.Id}`,
    companyId: row.CompanyId,
    roleCode,
    isActive: row.IsActive !== false && row.IsActive !== 0,
  };
}

async function fetchRows(url) {
  try {
    const res = await api.get(url);
    return Array.isArray(res.data?.data) ? res.data.data : [];
  } catch {
    return null;
  }
}

// Users who can cover accounts: the company's employees and managers. Managers are listed for
// every staff caller, or saving an account's assignments would drop its manager assignees.
export default function useAssignableUsers(callerRole) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [employees, managers] = await Promise.all([
        fetchRows("/employees"),
        fetchRows(managersUrl(callerRole)),
      ]);
      if (cancelled) return;
      setFailed(employees === null);
      setUsers([
        ...(employees || []).map((row) => toUser(row, "EMPLOYEE")),
        ...(managers || []).map((row) => toUser(row, "MANAGER")),
      ].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [callerRole]);

  return { users, loading, failed };
}
