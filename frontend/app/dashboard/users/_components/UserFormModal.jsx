"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import Modal, { ModalFooter } from "@/components/Modal";
import FormError from "@/components/FormError";
import { SelectField, TextField } from "@/components/FormFields";
import {
  EMPTY_FORM, formProblem, toBody, toForm,
} from "./userForm";

const STATUS_OPTIONS = [{ value: 1, label: "Active" }, { value: 0, label: "Inactive" }];

function useUserForm({ user, onSaved, showToast }) {
  const [form, setForm] = useState(() => (user ? toForm(user) : EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(user);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    const problem = formProblem(form, isEdit);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const body = toBody(form, isEdit);
      const res = isEdit
        ? await api.put(`/users/${user.Id}`, body)
        : await api.post("/users", body);
      if (!res.data?.success) {
        setError(res.data?.message || "Failed to save.");
        return;
      }
      onSaved(isEdit ? "User updated successfully!" : "User created successfully!");
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

function UserFields({
  form, set, isEdit, roles, companies,
}) {
  const roleOptions = roles.map((r) => ({ value: r.Id, label: r.Name }));
  const companyOptions = companies.map((c) => ({
    value: c.Id, label: c.City ? `${c.Name} — ${c.City}` : c.Name,
  }));
  const text = (key, id, label, extra = {}) => (
    <TextField id={id} label={label} value={form[key]} onChange={set(key)} {...extra} />
  );
  return (
    <>
      <div className="wk-form-row">
        {text("firstName", "user-first-name", "First name")}
        {text("lastName", "user-last-name", "Last name")}
      </div>
      {text("email", "user-email", "Email address", { type: "email", required: true })}
      <div className="wk-form-row">
        {text("username", "user-username", "Username")}
        {text("phoneNumber", "user-phone", "Phone", {
          type: "tel", placeholder: "+91 98765 43210",
        })}
      </div>
      {text("password", "user-password", isEdit ? "New password" : "Password", {
        type: "password",
        required: !isEdit,
        autoComplete: "new-password",
        hint: isEdit ? "Leave blank to keep the current password." : "At least 6 characters.",
      })}
      <div className="wk-form-row">
        <SelectField
          id="user-role"
          label="Role"
          required
          placeholder="Select role…"
          options={roleOptions}
          value={form.roleId}
          onChange={set("roleId")}
        />
        <SelectField
          id="user-status"
          label="Status"
          options={STATUS_OPTIONS}
          value={form.isActive}
          onChange={(v) => set("isActive")(Number(v))}
        />
      </div>
      <SelectField
        id="user-company"
        label="Company"
        placeholder="Select company…"
        options={companyOptions}
        value={form.companyId}
        onChange={set("companyId")}
      />
      {text("displayName", "user-display-name", "Display name")}
    </>
  );
}

// Add (user = null) or edit a user. Saving reloads the list through onSaved(message).
export default function UserFormModal({
  user, roles, companies, onClose, onSaved, showToast,
}) {
  const userForm = useUserForm({ user, onSaved, showToast });
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={userForm.save}
      busy={userForm.saving}
      label={userForm.isEdit ? "Update user" : "Add user"}
    />
  );
  return (
    <Modal
      icon={userForm.isEdit ? "edit" : "person_add"}
      labelId="user-form-title"
      title={userForm.isEdit ? "Edit user" : "Add new user"}
      sub={userForm.isEdit ? `Editing ${user.Email}` : "Create a new platform user"}
      onClose={onClose}
      footer={footer}
    >
      <FormError message={userForm.error} />
      <UserFields
        form={userForm.form}
        set={userForm.set}
        isEdit={userForm.isEdit}
        roles={roles}
        companies={companies}
      />
    </Modal>
  );
}
