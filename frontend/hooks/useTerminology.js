"use client";

import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthStatus, selectUser } from "@/store/authSlice";
import {
  DEFAULT_TERMINOLOGY,
  fetchTerminology,
  selectTerminology,
  selectTerminologyStatus,
} from "@/store/settingsSlice";

export function translate(labels, termKey) {
  return labels?.[termKey] || DEFAULT_TERMINOLOGY[termKey] || termKey;
}

// Settings are per company. A SUPER_ADMIN has no company of their own, so they read a
// chosen company's settings (companyId) and nothing at all until one is known; other
// roles always read their own company, whatever companyId is passed.
export function useSettingsCompany(companyId) {
  const user = useSelector(selectUser);
  const isSuperAdmin = user?.roleCode === "SUPER_ADMIN";
  const scopedId = isSuperAdmin && companyId ? Number(companyId) : null;
  return { companyId: scopedId, enabled: !isSuperAdmin || scopedId !== null };
}

// Loads a setting once per session. A signed-out session never fetches, so the
// session-expired flow (clearUser + redirect) cannot trigger a request loop.
export function useLoadOnce(status, load, enabled = true) {
  const authStatus = useSelector(selectAuthStatus);
  const canFetch = enabled && authStatus !== "unauthenticated";
  useEffect(() => {
    if (canFetch && status === "idle") load();
  }, [canFetch, status, load]);
  return { loading: canFetch && (status === "idle" || status === "loading") };
}

export function useTerminology() {
  const dispatch = useDispatch();
  const labels = useSelector(selectTerminology);
  const status = useSelector(selectTerminologyStatus);
  const { enabled } = useSettingsCompany(null);
  const load = useCallback(() => dispatch(fetchTerminology()), [dispatch]);
  const { loading } = useLoadOnce(status, load, enabled);
  const t = useCallback((termKey) => translate(labels, termKey), [labels]);
  const reload = useCallback(() => dispatch(fetchTerminology({ force: true })), [dispatch]);
  return { t, loading, reload };
}
