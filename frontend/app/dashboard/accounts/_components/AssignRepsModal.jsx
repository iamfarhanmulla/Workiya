"use client";

import { useEffect, useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import Modal, { ModalFooter } from "@/components/Modal";
import ErrorText from "@/components/FormError";
import useAssignableUsers from "./useAssignableUsers";

const ROLE_LABEL = { EMPLOYEE: "Employee", MANAGER: "Manager" };

function toSelection(assignments) {
  const selection = {};
  (assignments || []).forEach((a) => {
    selection[a.userId] = a.visitsPerMonth ? String(a.visitsPerMonth) : "";
  });
  return selection;
}

// Only users still listed (active, same company) are sent; the API rejects any other.
function toPayload(selection, users) {
  return users.filter((u) => u.userId in selection).map((u) => ({
    userId: u.userId,
    visitsPerMonth: selection[u.userId] === "" ? null : Number(selection[u.userId]),
  }));
}

function RepRow({
  user, checked, visits, onToggle, onVisits,
}) {
  const id = `assign-rep-${user.userId}`;
  return (
    <div className={`wk-assign-row${checked ? " is-selected" : ""}`}>
      <label htmlFor={id} className="wk-check wk-assign-name">
        <input id={id} type="checkbox" checked={checked} onChange={() => onToggle(user.userId)} />
        <span>
          {user.displayName}
          <span className="wk-muted">{` · ${ROLE_LABEL[user.roleCode]}`}</span>
        </span>
      </label>
      <input
        className="wk-input wk-assign-visits"
        type="number"
        min={1}
        max={31}
        aria-label={`Visits per month for ${user.displayName}`}
        placeholder="Visits/mo"
        disabled={!checked}
        value={visits}
        onChange={(e) => onVisits(user.userId, e.target.value)}
      />
    </div>
  );
}

function useCurrentAssignments(account) {
  const [selection, setSelection] = useState(() => toSelection(account.assignedUsers));
  useEffect(() => {
    let cancelled = false;
    api.get(`/accounts/${account.id}/assignments`)
      .then((res) => {
        if (!cancelled) setSelection(toSelection(res.data?.data));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [account.id]);
  return [selection, setSelection];
}

function RepList({
  users, loading, selection, setSelection,
}) {
  if (loading) return <p className="wk-muted">Loading reps…</p>;
  if (users.length === 0) return <p className="wk-muted">No active reps in this company.</p>;
  const toggle = (userId) => setSelection((prev) => {
    const next = { ...prev };
    if (userId in next) delete next[userId];
    else next[userId] = "";
    return next;
  });
  const setVisits = (userId, value) => setSelection((prev) => ({ ...prev, [userId]: value }));
  return (
    <div className="wk-assign-list">
      {users.map((user) => (
        <RepRow
          key={user.userId}
          user={user}
          checked={user.userId in selection}
          visits={selection[user.userId] ?? ""}
          onToggle={toggle}
          onVisits={setVisits}
        />
      ))}
    </div>
  );
}

function useAssignReps(account, callerRole, onSaved) {
  const { users, loading } = useAssignableUsers(callerRole);
  const [selection, setSelection] = useCurrentAssignments(account);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const companyUsers = users.filter((u) => u.isActive && u.companyId === account.companyId);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const assignments = toPayload(selection, companyUsers);
      await api.put(`/accounts/${account.id}/assignments`, { assignments });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save the assignments."));
    } finally {
      setSaving(false);
    }
  }

  return {
    companyUsers, loading, selection, setSelection, save, saving, error,
  };
}

// Checkbox per assignable rep plus an optional visits-per-month target.
export default function AssignRepsModal({
  account, callerRole, onClose, onSaved,
}) {
  const reps = useAssignReps(account, callerRole, onSaved);
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={reps.save}
      busy={reps.saving}
      label="Save Assignments"
    />
  );
  return (
    <Modal
      icon="group_add"
      labelId="assign-reps-title"
      title="Assign reps"
      sub={account.name}
      onClose={onClose}
      footer={footer}
    >
      <RepList
        users={reps.companyUsers}
        loading={reps.loading}
        selection={reps.selection}
        setSelection={reps.setSelection}
      />
      <ErrorText message={reps.error} />
    </Modal>
  );
}
