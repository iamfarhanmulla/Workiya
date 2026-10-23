"use client";

// Inline error shown inside a modal (e.g. the server's INVALID_EXTRA_FIELDS message).
export default function ErrorText({ message }) {
  if (!message) return null;
  return (
    <div className="wk-banner wk-banner--danger">
      <span className="material-symbols-outlined" aria-hidden="true">error</span>
      <div role="alert">{message}</div>
    </div>
  );
}
