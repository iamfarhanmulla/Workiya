"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import ModalShell from "./ModalShell";
import ActivityFormFields from "./ActivityFormFields";
import { isoToLocalInput, localInputToIso } from "./activityConfig";

function initialForm(activity) {
  const idOf = (value) => (value ? String(value) : "");
  return {
    activityTypeId: idOf(activity?.activityTypeId),
    accountId: idOf(activity?.accountId),
    assignedTo: idOf(activity?.assignedTo),
    title: activity?.title || "",
    description: activity?.description || "",
    priority: activity?.priority || "Medium",
    dueAt: isoToLocalInput(activity?.dueAtUtc),
  };
}

function missingField(form, accountLabel) {
  if (!form.title.trim()) return "Title is required.";
  if (!form.activityTypeId) return "Please select a type.";
  if (!form.accountId) return `Please select a ${accountLabel.toLowerCase()}.`;
  if (!form.assignedTo) return "Please choose who it is assigned to.";
  return null;
}

function toBody(form) {
  return {
    activityTypeId: Number(form.activityTypeId),
    accountId: Number(form.accountId),
    assignedTo: Number(form.assignedTo),
    title: form.title.trim(),
    description: form.description.trim() || null,
    priority: form.priority,
    dueAtUtc: localInputToIso(form.dueAt),
  };
}

function findAccount(accounts, accountId) {
  return accounts.find((a) => String(a.id) === String(accountId));
}

// A new activity belongs to its account's company (a SUPER_ADMIN must name it).
function createBody(form, accounts) {
  const account = findAccount(accounts, form.accountId);
  const body = toBody(form);
  return account?.companyId ? { ...body, companyId: account.companyId } : body;
}

// The company the activity belongs to: the edited activity's, else the chosen account's.
// A SUPER_ADMIN sees only that company's activity types and assignees.
function useCompanyChoices({
  activity, form, accounts, employees,
}) {
  const companyId = activity?.companyId ?? findAccount(accounts, form.accountId)?.companyId;
  const types = useActivityTypes(companyId).types.filter((type) => type.isActive !== false);
  const assignees = companyId
    ? employees.filter((e) => !e.CompanyId || e.CompanyId === companyId)
    : employees;
  return { types, assignees };
}

function useActivityForm({
  activity, accounts, employees, labels, onSaved, showToast,
}) {
  const [form, setForm] = useState(() => initialForm(activity));
  const [saving, setSaving] = useState(false);
  const { types, assignees } = useCompanyChoices({
    activity, form, accounts, employees,
  });
  // With a single activity type there is nothing to choose, so it is preselected.
  const typeId = form.activityTypeId || (types.length === 1 ? String(types[0].id) : "");
  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function save() {
    const next = { ...form, activityTypeId: typeId };
    const problem = missingField(next, labels.account);
    if (problem) {
      showToast(problem, "warning");
      return;
    }
    setSaving(true);
    try {
      if (activity) await api.put(`/activities/${activity.id}`, toBody(next));
      else await api.post("/activities", createBody(next, accounts));
      onSaved(`${labels.activity} ${activity ? "updated" : "created"}.`);
    } catch (err) {
      showToast(getErrorMessage(err, "Save failed."), "error");
      setSaving(false);
    }
  }

  return {
    form, typeId, set, saving, save, types, assignees,
  };
}

export default function ActivityFormModal({
  activity, accounts, employees, labels, onClose, onSaved, showToast,
}) {
  const {
    form, typeId, set, saving, save, types, assignees,
  } = useActivityForm({
    activity, accounts, employees, labels, onSaved, showToast,
  });
  const footer = (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
        <span className="material-symbols-outlined">send</span>
        {saving ? "Saving..." : "Save"}
      </button>
    </>
  );
  return (
    <ModalShell
      icon="assignment_add"
      title={activity ? `Edit ${labels.activity}` : `New ${labels.activity}`}
      sub={`Assign a ${labels.account.toLowerCase()} visit to a team member`}
      onClose={onClose}
      footer={footer}
    >
      <ActivityFormFields
        form={form}
        typeId={typeId}
        set={set}
        accounts={accounts}
        employees={assignees}
        types={types}
        accountLabel={labels.account}
      />
    </ModalShell>
  );
}
