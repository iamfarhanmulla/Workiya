"use client";

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchActivityTypes,
  selectCompanyActivityTypes,
  selectCompanyActivityTypesStatus,
} from "@/store/settingsSlice";
import { useLoadOnce, useSettingsCompany } from "./useTerminology";

// companyId: the record's company. It is used only for a SUPER_ADMIN (see useSettingsCompany).
// eslint-disable-next-line import-x/prefer-default-export -- hooks are named exports
export function useActivityTypes(recordCompanyId = null) {
  const dispatch = useDispatch();
  const { companyId, enabled } = useSettingsCompany(recordCompanyId);
  const types = useSelector(selectCompanyActivityTypes(companyId));
  const status = useSelector(selectCompanyActivityTypesStatus(companyId));
  const load = useCallback(
    () => dispatch(fetchActivityTypes({ companyId })),
    [dispatch, companyId],
  );
  const { loading } = useLoadOnce(status, load, enabled);
  const reload = useCallback(
    () => dispatch(fetchActivityTypes({ force: true, companyId })),
    [dispatch, companyId],
  );
  return { types, loading, reload };
}
