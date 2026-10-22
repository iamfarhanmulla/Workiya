"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

const SEARCH_DELAY_MS = 300;
const PAGE_SIZE = 200;

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function itemsOf(res) {
  const data = res?.data?.data;
  if (Array.isArray(data)) return data;
  return data?.items || [];
}

// Activities for the current filters. `loading` is derived from which request last
// finished, so no state is set synchronously inside the effect.
export function useActivities({ status, search }) {
  const term = useDebounced(search.trim(), SEARCH_DELAY_MS);
  const [token, setToken] = useState(0);
  const [result, setResult] = useState({
    key: null, items: [], total: 0, failed: false,
  });
  const key = JSON.stringify([status, term, token]);

  useEffect(() => {
    let cancelled = false;
    const params = { page: 1, pageSize: PAGE_SIZE };
    if (status !== "all") params.status = status;
    if (term) params.search = term;
    api.get("/activities", { params })
      .then((res) => {
        if (cancelled) return;
        const page = res.data?.data || {};
        setResult({
          key, items: page.items || [], total: page.total || 0, failed: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setResult({
            key, items: [], total: 0, failed: true,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, status, term]);

  return {
    items: result.items,
    total: result.total,
    failed: result.failed,
    loading: result.key !== key,
    reload: () => setToken((n) => n + 1),
  };
}

function isActiveRow(row) {
  return row.IsActive !== false && row.IsActive !== 0;
}

// Assignees as { Id, Name, CompanyId }: active employees plus the company's active managers,
// both of which the API accepts as an activity's assignee.
function toAssignees(employeesRes, managersRes) {
  const employees = itemsOf(employeesRes).filter(isActiveRow).map((row) => ({
    Id: row.Id,
    Name: `${row.FirstName || ""} ${row.LastName || ""}`.trim(),
    CompanyId: row.CompanyId,
  }));
  const managers = itemsOf(managersRes).map((row) => ({
    Id: row.Id, Name: String(row.Name || "").trim(), CompanyId: row.CompanyId,
  }));
  return [...employees, ...managers].sort((a, b) => a.Name.localeCompare(b.Name));
}

// Pickers for the create/edit modal: active accounts and assignable users. Only staff create
// activities, so an EMPLOYEE never calls /accounts or /employees from this page.
export function usePickers(isStaff) {
  const [pickers, setPickers] = useState({ accounts: [], employees: [] });

  useEffect(() => {
    if (!isStaff) return undefined;
    let cancelled = false;
    Promise.all([
      api.get("/accounts", { params: { pageSize: PAGE_SIZE, isActive: "true" } }).catch(() => null),
      api.get("/employees").catch(() => null),
      api.get("/employees/managers-list").catch(() => null),
    ]).then(([accountsRes, employeesRes, managersRes]) => {
      if (cancelled) return;
      setPickers({
        accounts: itemsOf(accountsRes),
        employees: toAssignees(employeesRes, managersRes),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isStaff]);

  return pickers;
}

export function usePendingReviews() {
  const [token, setToken] = useState(0);
  const [result, setResult] = useState({ key: null, items: [] });
  const key = String(token);

  useEffect(() => {
    let cancelled = false;
    api.get("/submissions", { params: { reviewStatus: "Pending", pageSize: PAGE_SIZE } })
      .then((res) => {
        if (!cancelled) setResult({ key, items: itemsOf(res) });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return {
    items: result.items,
    loading: result.key !== key,
    reload: () => setToken((n) => n + 1),
  };
}
