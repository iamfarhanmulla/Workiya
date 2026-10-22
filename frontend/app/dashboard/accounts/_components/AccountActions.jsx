"use client";

import activateOnKey from "@/app/dashboard/_utils/activateOnKey";

function IconButton({
  icon, title, onClick, danger,
}) {
  return (
    <div
      className={`icon-btn${danger ? " icon-btn-danger" : ""}`}
      title={title}
      aria-label={title}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={activateOnKey}
    >
      <span className="material-symbols-outlined">{icon}</span>
    </div>
  );
}

// View is always available; edit, assign, toggle and delete only for staff.
// handlers: { onView, onEdit, onAssign, onToggle, onDelete }; onToggle is optional.
export default function AccountActions({
  account, canManage, handlers, className,
}) {
  const {
    onView, onEdit, onAssign, onToggle, onDelete,
  } = handlers;
  return (
    <div className={className} style={className ? undefined : { display: "flex", gap: 4 }}>
      <IconButton icon="visibility" title="View" onClick={() => onView(account)} />
      {canManage && (
        <>
          <IconButton icon="edit" title="Edit" onClick={() => onEdit(account)} />
          <IconButton icon="group_add" title="Assign reps" onClick={() => onAssign(account)} />
          {onToggle && (
            <IconButton
              icon={account.isActive ? "toggle_on" : "toggle_off"}
              title={account.isActive ? "Deactivate" : "Activate"}
              onClick={() => onToggle(account)}
            />
          )}
          <IconButton icon="delete" title="Delete" danger onClick={() => onDelete(account)} />
        </>
      )}
    </div>
  );
}
