"use client";

import { useState } from "react";

const TOAST_MS = 3500;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = "success") {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
  }

  return { toasts, showToast };
}

// type -> toast modifier and icon. Errors use role="alert" so they are announced at once.
const CFG = {
  success: { tone: "success", icon: "check_circle" },
  error: { tone: "danger", icon: "error" },
  warning: { tone: "warning", icon: "warning" },
};

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="wk-app wk-toasts">
      {toasts.map((t) => {
        const c = CFG[t.type] || CFG.success;
        return (
          <div
            key={t.id}
            className={`wk-toast wk-toast--${c.tone}`}
            role={t.type === "error" ? "alert" : "status"}
          >
            <span className="material-symbols-outlined wk-icon--fill" aria-hidden="true">
              {c.icon}
            </span>
            <div className="wk-toast-title">{t.message}</div>
          </div>
        );
      })}
    </div>
  );
}
