"use client";

import {
  Fragment, useCallback, useEffect, useRef, useState,
} from "react";
import { api } from "@/lib/apiClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast, ToastContainer } from "@/components/Toast";
import LabelsSection from "./LabelsSection";
import CustomFieldsSection from "./CustomFieldsSection";
import VisitTypesSection from "./VisitTypesSection";
import { SettingsCard } from "./FormBits";

const EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN"];

// showToast is re-created on every render; sections need a stable function for their effects.
function useStableNotify() {
  const { toasts, showToast } = useToast();
  const ref = useRef(showToast);
  useEffect(() => {
    ref.current = showToast;
  });
  const notify = useCallback((message, type) => ref.current(message, type), []);
  return { toasts, notify };
}

function CompanyPicker({ companyId, onChange, notify }) {
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    api.get("/companies")
      .then((res) => setCompanies(res.data?.success ? res.data.data : []))
      .catch(() => notify("Failed to load companies.", "error"));
  }, [notify]);

  return (
    <SettingsCard
      id="company"
      title="Choose a company"
      desc="Labels, fields and types are set per company. Choose which one to edit."
    >
      <div className="wk-card-bd">
        <div className="wk-field" style={{ maxWidth: 360 }}>
          <label className="wk-label" htmlFor="stg-company">Company</label>
          <select
            id="stg-company"
            className="wk-select"
            value={companyId || ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Choose a company</option>
            {companies.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
          </select>
        </div>
      </div>
    </SettingsCard>
  );
}

export default function FieldsAndLabels() {
  const user = useCurrentUser();
  const { toasts, notify } = useStableNotify();
  const [companyId, setCompanyId] = useState(null);
  const isSuperAdmin = user?.roleCode === "SUPER_ADMIN";

  if (!EDITOR_ROLES.includes(user?.roleCode)) return null;
  const ready = !isSuperAdmin || !!companyId;

  return (
    <>
      <ToastContainer toasts={toasts} />
      {isSuperAdmin && (
        <CompanyPicker companyId={companyId} onChange={setCompanyId} notify={notify} />
      )}
      {ready && (
        <Fragment key={companyId || "own"}>
          <LabelsSection companyId={companyId} notify={notify} />
          <CustomFieldsSection companyId={companyId} notify={notify} />
          <VisitTypesSection companyId={companyId} notify={notify} />
        </Fragment>
      )}
    </>
  );
}
