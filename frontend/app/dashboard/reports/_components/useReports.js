"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";

// Loads the coverage report and the weekly trend for one month (and company, for a
// SUPER_ADMIN). reload() refetches both, e.g. after "Run missed check now".
export default function useReports({ month, params, ready }) {
  const [state, setState] = useState({
    loading: true, error: "", coverage: null, trend: [],
  });
  const companyId = params.companyId ?? null;

  const reload = useCallback(async () => {
    if (!ready) return;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    const query = { month, ...(companyId ? { companyId } : {}) };
    try {
      const [coverage, trend] = await Promise.all([
        api.get("/reports/coverage", { params: query }),
        api.get("/reports/trend", { params: { weeks: 8, ...(companyId ? { companyId } : {}) } }),
      ]);
      setState({
        loading: false, error: "", coverage: coverage.data.data, trend: trend.data.data,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev, loading: false, error: getErrorMessage(err, "Couldn't load reports."),
      }));
    }
  }, [month, companyId, ready]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
