"use client";

import Modal, { ModalFooter } from "@/components/Modal";

// Add/edit dialog for a label set, custom field or visit type: Cancel + Save footer.
export default function SettingsModal({
  title, sub, icon, saving, onClose, onSave, children,
}) {
  return (
    <Modal
      icon={icon}
      labelId="settings-dialog-title"
      title={title}
      sub={sub}
      onClose={onClose}
      footer={<ModalFooter onCancel={onClose} onSubmit={onSave} busy={saving} label="Save" />}
    >
      {children}
    </Modal>
  );
}
