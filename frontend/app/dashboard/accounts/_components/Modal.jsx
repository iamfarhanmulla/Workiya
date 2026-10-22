"use client";

// Cancel + primary action footer used by every account modal.
export function ModalFooter({
  onCancel, onSubmit, busy, icon = "save", label, busyLabel = "Saving...",
}) {
  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={busy}>
        <span className="material-symbols-outlined">{icon}</span>
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

// Shared modal shell (overlay, header with icon, body, footer) in the dashboard style.
export default function Modal({
  icon, title, sub, onClose, footer, children, maxWidth = 560, labelId,
}) {
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        style={{ maxWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
      >
        <div className="modal-header">
          <div className="modal-header-icon">
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div>
            <div className="modal-title" id={labelId}>{title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
