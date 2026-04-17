"use client";

export function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onCancel()}
      style={{ zIndex: 8500 }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, padding: "32px 28px 24px",
        maxWidth: 400, width: "90%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        animation: "scaleIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both",
        textAlign: "center",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "#FEE2E2", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 18px",
        }}>
          <span className="material-symbols-outlined" style={{ color: "#EF4444", fontSize: 32, fontVariationSettings: "'FILL' 1" }}>
            delete_forever
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.6, marginBottom: 24 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn btn-outline btn-sm" style={{ minWidth: 110 }} onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-sm"
            style={{ minWidth: 110, background: "#EF4444", color: "#fff", justifyContent: "center" }}
            onClick={onConfirm}
          >
            <span className="material-symbols-outlined">delete</span>
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}
