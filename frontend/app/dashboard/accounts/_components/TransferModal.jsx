"use client";

import { useState } from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import Modal, { ModalFooter } from "@/components/Modal";
import ErrorText from "./ErrorText";
import useAssignableUsers from "./useAssignableUsers";

function UserSelect({
  id, label, users, value, onChange,
}) {
  return (
    <div className="wk-field">
      <label htmlFor={id} className="wk-label">{label}</label>
      <select
        id={id}
        className="wk-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a user</option>
        {users.map((u) => (
          <option key={u.userId} value={u.userId}>
            {u.displayName}{u.isActive ? "" : " (inactive)"}
          </option>
        ))}
      </select>
    </div>
  );
}

function buildBody(fromUser, toUserId, isSuperAdmin) {
  const body = { fromUserId: fromUser.userId, toUserId: Number(toUserId) };
  if (isSuperAdmin) body.companyId = fromUser.companyId;
  return body;
}

// Active users of the same company as the source user, excluding the source user.
function transferTargets(users, fromUser) {
  if (!fromUser) return [];
  return users.filter((u) => (
    u.isActive && u.userId !== fromUser.userId && u.companyId === fromUser.companyId
  ));
}

function useTransfer(callerRole, onDone) {
  const { users } = useAssignableUsers(callerRole);
  const [fromId, setFromIdState] = useState("");
  const [toId, setToId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fromUser = users.find((u) => String(u.userId) === fromId);

  function setFromId(value) {
    setFromIdState(value);
    setToId("");
  }

  async function submit() {
    if (!fromUser || !toId) return setError("Choose both users.");
    setSaving(true);
    setError("");
    try {
      const body = buildBody(fromUser, toId, callerRole === "SUPER_ADMIN");
      const res = await api.post("/accounts/assignments/transfer", body);
      return onDone(res.data?.data?.moved ?? 0);
    } catch (err) {
      return setError(getErrorMessage(err, "Transfer failed."));
    } finally {
      setSaving(false);
    }
  }

  return {
    users,
    targets: transferTargets(users, fromUser),
    fromId,
    setFromId,
    toId,
    setToId,
    submit,
    saving,
    error,
  };
}

// Moves every account of one rep to another rep of the same company.
export default function TransferModal({
  plural, callerRole, onClose, onDone,
}) {
  const transfer = useTransfer(callerRole, onDone);
  const footer = (
    <ModalFooter
      onCancel={onClose}
      onSubmit={transfer.submit}
      busy={transfer.saving}
      icon="swap_horiz"
      label="Transfer"
      busyLabel="Transferring..."
    />
  );
  return (
    <Modal
      icon="swap_horiz"
      labelId="transfer-title"
      title={`Transfer ${plural}`}
      sub={`Move all ${plural.toLowerCase()} of one rep to another`}
      onClose={onClose}
      footer={footer}
    >
      <UserSelect
        id="transfer-from"
        label="From"
        users={transfer.users}
        value={transfer.fromId}
        onChange={transfer.setFromId}
      />
      <UserSelect
        id="transfer-to"
        label="To"
        users={transfer.targets}
        value={transfer.toId}
        onChange={transfer.setToId}
      />
      <ErrorText message={transfer.error} />
    </Modal>
  );
}
