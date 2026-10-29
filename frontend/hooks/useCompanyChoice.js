"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

// Plans and reports belong to one company. A SUPER_ADMIN has none of their own, so they pick
// one; everyone else always works on their own company (params stays empty).
// eslint-disable-next-line import-x/prefer-default-export -- hooks are named exports
export function useCompanyChoice(user) {
  const isSuper = user?.roleCode === "SUPER_ADMIN";
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");

  useEffect(() => {
    if (!isSuper) return undefined;
    let live = true;
    api.get("/companies")
      .then((res) => {
        if (live) setCompanies((res.data.data || []).filter((c) => c.IsActive !== false));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isSuper]);

  return {
    isSuper,
    companies,
    companyId,
    setCompanyId,
    ready: !isSuper || companyId !== "",
    params: isSuper && companyId ? { companyId: Number(companyId) } : {},
  };
}
