"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import Modal, { ModalFooter } from "@/components/Modal";
import FormError from "@/components/FormError";
import { SelectField, TextField } from "@/components/FormFields";
import {
  EMPTY_FORM, PLAN_OPTIONS, formProblem, toForm,
} from "./companyForm";

const STATUS_OPTIONS = [{ value: 1, label: "Active" }, { value: 0, label: "Inactive" }];

function useCompanyForm({ company, onSaved, showToast }) {
  const [form, setForm] = useState(() => (company ? toForm(company) : EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(company);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const problem = formProblem(form);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const res = isEdit
        ? await api.put(`/companies/${company.Id}`, form)
        : await api.post("/companies", form);
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to save.");
        return;
      }
      onSaved(isEdit ? "Company updated successfully!" : "Company created successfully!");
    } catch (err) {
      const message = getErrorMessage(err, "Failed to save.");
      setError(message);
      if (!err.response) showToast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  return {
    form, set, save, saving, error, isEdit,
  };
}

function CompanyFields({ form, set }) {
  const text = (key, id, label, extra = {}) => (
    <TextField id={id} label={label} value={form[key]} onChange={set(key)} {...extra} />
  );
  return (
    <>
      <div className="wk-form-row">
        {text("name", "company-name", "Company name", { required: true, placeholder: "Acme Corp" })}
        {text("key", "company-key", "Key / slug", {
          placeholder: "acme-corp", hint: "Generated from the name when left blank.",
        })}
      </div>
      <div className="wk-form-row">
        {text("contactEmail", "company-email", "Contact email", {
          type: "email", placeholder: "contact@company.com",
        })}
        {text("contactPhone", "company-phone", "Contact phone", {
          type: "tel", placeholder: "+91 98765 43210",
        })}
      </div>
      {text("address", "company-address", "Address", { placeholder: "123 Main Street" })}
      <div className="wk-form-row">
        {text("city", "company-city", "City", { placeholder: "Mumbai" })}
        {text("country", "company-country", "Country", { placeholder: "India" })}
      </div>
      <div className="wk-form-row">
        <SelectField
          id="company-plan"
          label="Plan"
          options={PLAN_OPTIONS}
          value={form.plan}
          onChange={set("plan")}
        />
        <SelectField
          id="company-status"
          label="Status"
          options={STATUS_OPTIONS}
          value={form.isActive}
          onChange={(v) => set("isActive")(Number(v))}
        />
      </div>
    </>
  );
}

// Add (company = null) or edit a company. Saving reloads the list through onSaved(message).
export default function CompanyFormModal({
  company, onClose, onSaved, showToast,
}) {
  const companyForm = useCompanyForm({ company, onSaved, showToast });
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={companyForm.save}
      busy={companyForm.saving}
      label={companyForm.isEdit ? "Update company" : "Add company"}
    />
  );
  return (
    <Modal
      icon={companyForm.isEdit ? "edit" : "corporate_fare"}
      labelId="company-form-title"
      title={companyForm.isEdit ? "Edit company" : "Add new company"}
      sub={companyForm.isEdit ? `Editing ${company.Name}` : "Register a new organization"}
      onClose={onClose}
      footer={footer}
    >
      <FormError message={companyForm.error} />
      <CompanyFields form={companyForm.form} set={companyForm.set} />
    </Modal>
  );
}
