"use client";

import { useTerminology } from "@/hooks/useTerminology";

function IconButton({
  icon, label, onClick, danger,
}) {
  const tone = danger ? " wk-btn--ghost-danger" : "";
  return (
    <button
      type="button"
      className={`wk-btn wk-btn--ghost wk-btn--icon wk-btn--sm${tone}`}
      title={label}
      aria-label={label}
      onClick={onClick}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </button>
  );
}

// View is always available; edit, assign, toggle and delete only for staff.
// handlers: { onView, onEdit, onAssign, onToggle, onDelete }; onToggle is optional.
export default function AccountActions({ account, canManage, handlers }) {
  const { t } = useTerminology();
  const {
    onView, onEdit, onAssign, onToggle, onDelete,
  } = handlers;
  return (
    <div className="wk-row-actions">
      <IconButton icon="visibility" label="View" onClick={() => onView(account)} />
      {canManage && (
        <>
          <IconButton icon="edit" label="Edit" onClick={() => onEdit(account)} />
          <IconButton
            icon="group_add"
            label={`Assign ${t("rep.plural")}`}
            onClick={() => onAssign(account)}
          />
          {onToggle && (
            <IconButton
              icon={account.isActive ? "toggle_on" : "toggle_off"}
              label={account.isActive ? "Deactivate" : "Activate"}
              onClick={() => onToggle(account)}
            />
          )}
          <IconButton icon="delete" label="Delete" danger onClick={() => onDelete(account)} />
        </>
      )}
    </div>
  );
}
