"use client";

import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchCustomFields,
  selectCustomFields,
  selectCustomFieldsStatus,
} from "@/store/settingsSlice";
import { useLoadOnce, useSettingsCompany } from "./useTerminology";

function compareFields(a, b) {
  const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  if (order !== 0) return order;
  return String(a.label ?? "").localeCompare(String(b.label ?? ""));
}

export function activeSortedFields(fields) {
  return (fields ?? []).filter((f) => f.isActive !== false).sort(compareFields);
}

// companyId: the record's company. It is used only for a SUPER_ADMIN (see useSettingsCompany).
export function useCustomFields(entityType, recordCompanyId = null) {
  const dispatch = useDispatch();
  const { companyId, enabled } = useSettingsCompany(recordCompanyId);
  const items = useSelector(selectCustomFields(entityType, companyId));
  const status = useSelector(selectCustomFieldsStatus(entityType, companyId));
  const load = useCallback(
    () => dispatch(fetchCustomFields(entityType, { companyId })),
    [dispatch, entityType, companyId],
  );
  const { loading } = useLoadOnce(status, load, enabled);
  const fields = useMemo(() => activeSortedFields(items), [items]);
  const reload = useCallback(
    () => dispatch(fetchCustomFields(entityType, { force: true, companyId })),
    [dispatch, entityType, companyId],
  );
  return { fields, loading, reload };
}
