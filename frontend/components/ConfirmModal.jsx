"use client";

import Modal from "@/components/Modal";

// Six dashboard pages import { ConfirmModal } by name.
// eslint-disable-next-line import-x/prefer-default-export -- named export is the public API
export function ConfirmModal({
  open, title, message, onConfirm, onCancel,
}) {
  if (!open) return null;
  // "Yes, Delete" keeps the confirm button distinct from each row's own "Delete" button.
  const footer = (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onCancel}>Cancel</button>
      <button type="button" className="wk-btn wk-btn--danger" onClick={onConfirm}>
        <span className="material-symbols-outlined" aria-hidden="true">delete</span>
        Yes, Delete
      </button>
    </>
  );
  return (
    <Modal
      icon="delete"
      tone="danger"
      size="sm"
      labelId="confirm-delete-title"
      title={title}
      sub={message}
      onClose={onCancel}
      footer={footer}
    />
  );
}
