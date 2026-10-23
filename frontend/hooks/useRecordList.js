"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// GETs an endpoint whose `data` is an array (users, managers, companies, roles…).
// error: "" | "load" (the server answered with a failure) | "network" (no answer).
// optional: true for picker lists, where a failure just means an empty list.
// `loading` is derived from which request last finished, so no state is set
// synchronously inside the effect.
export default function useRecordList(path, { optional = false } = {}) {
  const [token, setToken] = useState(0);
  const [result, setResult] = useState({ key: null, items: [], error: "" });
  const key = `${path}#${token}`;

  useEffect(() => {
    let cancelled = false;
    api.get(path)
      .then((res) => {
        if (cancelled) return;
        const ok = Boolean(res.data?.success);
        const error = ok || optional ? "" : "load";
        setResult({ key, items: ok ? (res.data.data || []) : [], error });
      })
      .catch((err) => {
        if (cancelled) return;
        let error = err.response ? "load" : "network";
        if (optional) error = "";
        setResult({ key, items: [], error });
      });
    return () => {
      cancelled = true;
    };
  }, [key, path, optional]);

  return {
    items: result.items,
    error: result.error,
    loading: result.key !== key,
    reload: () => setToken((n) => n + 1),
  };
}
