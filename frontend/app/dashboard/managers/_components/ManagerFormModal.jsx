"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import Modal, { ModalFooter } from "@/components/Modal";
import FormError from "@/components/FormError";
import { SelectField, TextField } from "@/components/FormFields";
import {
  EMPTY_FORM, formProblem, toBody, toForm,
} from "./managerForm";

const STATUS_OPTIONS = [{ value: 1, label: "Active" }, { value: 0, label: "Inactive" }];

function useManagerForm({ manager, onSaved, showToast }) {
  const [form, setForm] = useState(() => (manager ? toForm(manager) : EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(manager);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const problem = formProblem(form, isEdit);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const body = toBody(form, isEdit);
      const res = isEdit
        ? await api.put(`/managers/${manager.Id}`, body)
        : await api.post("/managers", body);
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to save.");
        return;
      }
      onSaved(isEdit ? "Manager updated successfully!" : "Manager created successfully!");
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

function ManagerFields({
  form, set, isEdit, companies,
}) {
  const text = (key, id, label, extra = {}) => (
    <TextField id={id} label={label} value={form[key]} onChange={set(key)} {...extra} />
  );
  return (
    <>
      <div className="wk-form-row">
        {text("firstName", "manager-first-name", "First name")}
        {text("lastName", "manager-last-name", "Last name")}
      </div>
      {text("email", "manager-email", "Email address", { type: "email", required: true })}
      <div className="wk-form-row">
        {text("phoneNumber", "manager-phone", "Phone", {
          type: "tel", placeholder: "+91 98765 43210",
        })}
        {text("password", "manager-password", isEdit ? "New password" : "Password", {
          type: "password",
          required: !isEdit,
          autoComplete: "new-password",
          hint: isEdit ? "Leave blank to keep the current password." : "At least 6 characters.",
        })}
      </div>
      <div className="wk-form-row">
        <SelectField
          id="manager-company"
          label="Company"
          placeholder="Select company…"
          options={companies.map((c) => ({ value: c.Id, label: c.Name }))}
          value={form.companyId}
          onChange={set("companyId")}
        />
        <SelectField
          id="manager-status"
          label="Status"
          options={STATUS_OPTIONS}
          value={form.isActive}
          onChange={(v) => set("isActive")(Number(v))}
        />
      </div>
    </>
  );
}

// Add (manager = null) or edit a manager. Saving reloads the list through onSaved(message).
export default function ManagerFormModal({
  manager, companies, onClose, onSaved, showToast,
}) {
  const managerForm = useManagerForm({ manager, onSaved, showToast });
  const { isEdit } = managerForm;
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={managerForm.save}
      busy={managerForm.saving}
      label={isEdit ? "Update manager" : "Add manager"}
    />
  );
  return (
    <Modal
      icon={isEdit ? "edit" : "person_add"}
      labelId="manager-form-title"
      title={isEdit ? "Edit manager" : "Add new manager"}
      sub={isEdit ? `Editing ${manager.Email}` : "Managers lead a team of field employees"}
      onClose={onClose}
      footer={footer}
    >
      <FormError message={managerForm.error} />
      <ManagerFields
        form={managerForm.form}
        set={managerForm.set}
        isEdit={isEdit}
        companies={companies}
      />
    </Modal>
  );
}
