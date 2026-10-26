"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/apiClient";
import { dayRange } from "./dashboardStats";

// The API caps a page at 200 rows; a day with more shows a "first 200" note.
export const TODAY_PAGE_SIZE = 200;
export const REVIEW_PAGE_SIZE = 5;

// One GET of a paged list. `loading` is derived from which request last finished,
// so no state is set synchronously inside the effect.
function usePagedList(path, params, enabled) {
  const [token, setToken] = useState(0);
  const [result, setResult] = useState({
    key: null, items: [], total: 0, failed: false,
  });
  const key = JSON.stringify([path, params, token]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api.get(path, { params })
      .then((res) => {
        const page = res.data?.data || {};
        if (!cancelled) {
          setResult({
            key, items: page.items || [], total: page.total || 0, failed: false,
          });
        }
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
  }, [key, path, params, enabled]);

  return {
    items: result.items,
    total: result.total,
    failed: result.failed,
    loading: enabled && result.key !== key,
    reload: () => setToken((n) => n + 1),
  };
}

// Activities due today. Employees only ever get their own (scoped by the API).
export function useTodayActivities() {
  const params = useMemo(() => ({ ...dayRange(), page: 1, pageSize: TODAY_PAGE_SIZE }), []);
  return usePagedList("/activities", params, true);
}

// Newest reports waiting for review; only staff may review, so only staff ask.
export function usePendingReviews(enabled) {
  const params = useMemo(
    () => ({ reviewStatus: "Pending", page: 1, pageSize: REVIEW_PAGE_SIZE }),
    [],
  );
  return usePagedList("/submissions", params, enabled);
}
