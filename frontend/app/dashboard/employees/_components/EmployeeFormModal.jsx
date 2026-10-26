"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import Modal, { ModalFooter } from "@/components/Modal";
import FormError from "@/components/FormError";
import { SelectField, TextField } from "@/components/FormFields";
import {
  EMPTY_FORM, formProblem, managerLabel, toBody, toForm,
} from "./employeeForm";

const STATUS_OPTIONS = [{ value: 1, label: "Active" }, { value: 0, label: "Inactive" }];

function useEmployeeForm({ employee, onSaved, showToast }) {
  const [form, setForm] = useState(() => (employee ? toForm(employee) : EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(employee);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const problem = formProblem(form, isEdit);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const body = toBody(form, isEdit);
      const res = isEdit
        ? await api.put(`/employees/${employee.Id}`, body)
        : await api.post("/employees", body);
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to save.");
        return;
      }
      onSaved(isEdit ? "Employee updated successfully!" : "Employee created successfully!");
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

function AssignmentFields({
  form, set, companies, managers,
}) {
  return (
    <div className="wk-form-row">
      <SelectField
        id="employee-company"
        label="Company"
        placeholder="Select company…"
        options={companies.map((c) => ({ value: c.Id, label: c.Name }))}
        value={form.companyId}
        onChange={set("companyId")}
      />
      <SelectField
        id="employee-manager"
        label="Manager"
        placeholder="Select manager…"
        options={managers.map((m) => ({ value: m.Id, label: managerLabel(m) }))}
        value={form.managerId}
        onChange={set("managerId")}
      />
    </div>
  );
}

function EmployeeFields({
  form, set, isEdit, companies, managers,
}) {
  const text = (key, id, label, extra = {}) => (
    <TextField id={id} label={label} value={form[key]} onChange={set(key)} {...extra} />
  );
  return (
    <>
      <div className="wk-form-row">
        {text("firstName", "employee-first-name", "First name", { placeholder: "John" })}
        {text("lastName", "employee-last-name", "Last name", { placeholder: "Doe" })}
      </div>
      {text("email", "employee-email", "Email address", {
        type: "email", required: true, placeholder: "employee@company.com",
      })}
      <div className="wk-form-row">
        {text("phoneNumber", "employee-phone", "Phone", {
          type: "tel", placeholder: "+91 98765 43210",
        })}
        {text("password", "employee-password", isEdit ? "New password" : "Password", {
          type: "password",
          required: !isEdit,
          autoComplete: "new-password",
          hint: isEdit ? "Leave blank to keep the current password." : "At least 6 characters.",
        })}
      </div>
      <AssignmentFields form={form} set={set} companies={companies} managers={managers} />
      <div className="wk-form-row">
        {text("displayName", "employee-display-name", "Display name", { placeholder: "John Doe" })}
        <SelectField
          id="employee-status"
          label="Status"
          options={STATUS_OPTIONS}
          value={form.isActive}
          onChange={(v) => set("isActive")(Number(v))}
        />
      </div>
    </>
  );
}

// Add (employee = null) or edit an employee. Saving reloads the list through onSaved(message).
export default function EmployeeFormModal({
  employee, companies, managers, onClose, onSaved, showToast,
}) {
  const employeeForm = useEmployeeForm({ employee, onSaved, showToast });
  const { isEdit } = employeeForm;
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={employeeForm.save}
      busy={employeeForm.saving}
      label={isEdit ? "Update employee" : "Add employee"}
    />
  );
  return (
    <Modal
      icon={isEdit ? "edit" : "person_add"}
      labelId="employee-form-title"
      title={isEdit ? "Edit employee" : "Add new employee"}
      sub={isEdit ? `Editing ${employee.Email}` : "Create a new employee account"}
      onClose={onClose}
      footer={footer}
    >
      <FormError message={employeeForm.error} />
      <EmployeeFields
        form={employeeForm.form}
        set={employeeForm.set}
        isEdit={isEdit}
        companies={companies}
        managers={managers}
      />
    </Modal>
  );
}
