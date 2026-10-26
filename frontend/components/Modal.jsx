"use client";

import { useEffect, useRef } from "react";

// Cancel + primary action footer used by most dialogs.
export function ModalFooter({
  onCancel, onSubmit, busy, icon = "save", label, busyLabel = "Saving…",
}) {
  return (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onCancel}>Cancel</button>
      <button
        type="button"
        className="wk-btn wk-btn--primary"
        onClick={onSubmit}
        disabled={busy}
        aria-busy={busy}
      >
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        {busy ? busyLabel : label}
      </button>
    </>
  );
}

// Dialog shell: overlay, header (icon, title, subtitle, close), scrolling body, footer.
// Escape or a click on the overlay closes it; focus moves into the dialog on open.
// size: "sm" (420px) | "md" (560px) | "lg" (720px). tone: "danger" tints the icon.
export default function Modal({
  icon, title, sub, onClose, footer, children, size = "md", tone, labelId,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  const iconClass = `wk-modal-icon${tone ? ` wk-modal-icon--${tone}` : ""}`;

  // Keep the latest onClose for the Escape listener without re-subscribing it.
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKeyDown(e) {
      if (e.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className="wk-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className={`wk-app wk-modal wk-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
      >
        <div className="wk-modal-hd">
          <div className="wk-modal-hd-main">
            {icon && (
              <span className={iconClass} aria-hidden="true">
                <span className="material-symbols-outlined">{icon}</span>
              </span>
            )}
            <div>
              <h2 className="wk-modal-title" id={labelId}>{title}</h2>
              {sub && <p className="wk-modal-sub">{sub}</p>}
            </div>
          </div>
          <button
            type="button"
            className="wk-btn wk-btn--ghost wk-btn--icon wk-btn--sm"
            aria-label="Close"
            onClick={onClose}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div className="wk-modal-bd">{children}</div>
        {footer && <div className="wk-modal-ft">{footer}</div>}
      </div>
    </div>
  );
}
