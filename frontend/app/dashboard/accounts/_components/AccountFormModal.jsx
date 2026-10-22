"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import CustomFieldInputs from "@/components/CustomFieldInputs";
import { useCustomFields } from "@/hooks/useCustomFields";
import AccountFormFields from "./AccountFormFields";
import ErrorText from "./ErrorText";
import Modal, { ModalFooter } from "./Modal";
import { BLANK_FORM, toBody, toForm } from "./accountForm";

const ID_PREFIX = "account-form";

function CompanySelect({ companies, value, onChange }) {
  return (
    <div className="form-group">
      <label htmlFor={`${ID_PREFIX}-company`} className="form-label">
        Company<span style={{ color: "#EF4444" }}> *</span>
      </label>
      <select
        id={`${ID_PREFIX}-company`}
        className="form-select"
        value={value}
        onChange={(e) => onChange("companyId", e.target.value)}
      >
        <option value="">Select Company</option>
        {companies.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
      </select>
    </div>
  );
}

function useAccountForm({ account, isSuperAdmin, onSaved }) {
  const [form, setForm] = useState(account ? toForm(account) : BLANK_FORM);
  // A SUPER_ADMIN sees the custom fields of the account's (or the chosen) company.
  const { fields } = useCustomFields("ACCOUNT", form.companyId || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function save() {
    if (!form.name.trim()) return setError("Name is required.");
    if (!account && isSuperAdmin && !form.companyId) return setError("Select a company.");
    setSaving(true);
    setError("");
    try {
      const body = toBody(form, { includeCompany: !account && isSuperAdmin, fields });
      if (account) await api.put(`/accounts/${account.id}`, body);
      else await api.post("/accounts", body);
      return onSaved(Boolean(account));
    } catch (err) {
      return setError(getErrorMessage(err, "Save failed."));
    } finally {
      setSaving(false);
    }
  }

  return {
    form, fields, setField, save, saving, error,
  };
}

// Add/edit modal. account = null for a new record.
export default function AccountFormModal({
  account, singular, companies, isSuperAdmin, onClose, onSaved,
}) {
  const {
    form, fields, setField, save, saving, error,
  } = useAccountForm({ account, isSuperAdmin, onSaved });
  const footer = (
    <ModalFooter onCancel={onClose} onSubmit={save} busy={saving} label={`Save ${singular}`} />
  );
  return (
    <Modal
      icon="medical_services"
      labelId="account-form-title"
      title={account ? `Edit ${singular}` : `Add New ${singular}`}
      sub={`${singular} details are used for visits and assignments`}
      onClose={onClose}
      footer={footer}
      maxWidth={620}
    >
      <AccountFormFields form={form} onChange={setField} singular={singular} idPrefix={ID_PREFIX} />
      {isSuperAdmin && !account && (
        <CompanySelect companies={companies} value={form.companyId} onChange={setField} />
      )}
      <CustomFieldInputs
        fields={fields || []}
        values={form.extraFields}
        onChange={(next) => setField("extraFields", next)}
        idPrefix={`${ID_PREFIX}-extra`}
      />
      <ErrorText message={error} />
    </Modal>
  );
}
