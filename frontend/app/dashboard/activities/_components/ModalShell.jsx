"use client";

// The page's modal frame (same classes as the other dashboard modals): header with
// icon, title and close button, a body and a footer. Clicking the backdrop closes it.
export default function ModalShell({
  icon, iconBg = "#EEF2FF", iconColor = "#6366F1", title, sub, maxWidth = 560, onClose,
  footer, children,
}) {
  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <div className="modal-header-icon" style={{ background: iconBg }}>
            <span
              className="material-symbols-outlined"
              style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }}
            >
              {icon}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="modal-title" style={{ whiteSpace: "normal" }}>{title}</div>
            {sub && <div className="modal-sub">{sub}</div>}
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="modal-body" style={{ gap: 14 }}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
