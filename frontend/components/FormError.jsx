"use client";

// Form or dialog error: the banner is decoration, only the message is announced.
export default function FormError({ message }) {
  if (!message) return null;
  return (
    <div className="wk-banner wk-banner--danger">
      <span className="material-symbols-outlined" aria-hidden="true">error</span>
      <div role="alert">{message}</div>
    </div>
  );
}
