"use client";

import { useState } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  return { toasts, showToast };
}

const CFG = {
  success: {
    bg: "#D1FAE5", border: "#10B981", color: "#065F46", icon: "#10B981", name: "check_circle",
  },
  error: {
    bg: "#FEE2E2", border: "#EF4444", color: "#991B1B", icon: "#EF4444", name: "cancel",
  },
  warning: {
    bg: "#FEF3C7", border: "#F59E0B", color: "#92400E", icon: "#F59E0B", name: "warning",
  },
};

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed",
      top: 24,
      right: 24,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      pointerEvents: "none",
    }}
    >
      {toasts.map((t) => {
        const c = CFG[t.type] || CFG.success;
        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: c.bg,
              border: `1.5px solid ${c.border}`,
              borderRadius: 12,
              padding: "13px 18px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              minWidth: 270,
              maxWidth: 380,
              animation: "toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
              pointerEvents: "all",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                color: c.icon, fontSize: 20, fontVariationSettings: "'FILL' 1", flexShrink: 0,
              }}
            >
              {c.name}
            </span>
            <span style={{
              flex: 1, fontSize: 13, fontWeight: 600, color: c.color, lineHeight: 1.4,
            }}
            >{t.message}
            </span>
            <div style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              height: 3,
              background: c.border,
              animation: "toastProgress 3.5s linear forwards",
              borderRadius: "0 0 12px 12px",
            }}
            />
          </div>
        );
      })}
    </div>
  );
}
