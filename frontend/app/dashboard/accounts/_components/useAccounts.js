"use client";

import {
  useCallback, useEffect, useState,
} from "react";
import { api } from "@/lib/apiClient";
import { PAGE_SIZE } from "./accountForm";

const STATUS_PARAM = { active: "true", inactive: "false" };
const SEARCH_DEBOUNCE_MS = 300;

function buildParams({ page, search, status }) {
  const params = { page, pageSize: PAGE_SIZE };
  if (search.trim()) params.search = search.trim();
  if (STATUS_PARAM[status]) params.isActive = STATUS_PARAM[status];
  return params;
}

// Fetches one page whenever the query or the reload counter changes (search is debounced).
function useAccountsQuery(query, version, onError) {
  const [result, setResult] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const { page, search, status } = query;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get("/accounts", { params: buildParams({ page, search, status }) });
        const data = res.data?.data || {};
        if (!cancelled) setResult({ items: data.items || [], total: data.total || 0 });
      } catch {
        if (!cancelled) onError();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, search ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // onError is a toast callback re-created on every render; listing it would refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [page, search, status, version]);

  return { ...result, loading };
}

// GET /accounts with search, status filter and paging. A new search or status goes to page 1.
export default function useAccounts(onError) {
  const [query, setQuery] = useState({ page: 1, search: "", status: "all" });
  const [version, setVersion] = useState(0);
  const { items, total, loading } = useAccountsQuery(query, version, onError);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setPage = useCallback((page) => setQuery((q) => ({ ...q, page })), []);
  const setSearch = useCallback((search) => setQuery((q) => ({ ...q, search, page: 1 })), []);
  const setStatus = useCallback((status) => setQuery((q) => ({ ...q, status, page: 1 })), []);

  return {
    items,
    total,
    page: query.page,
    pageSize: PAGE_SIZE,
    setPage,
    search: query.search,
    setSearch,
    status: query.status,
    setStatus,
    loading,
    reload,
  };
}
