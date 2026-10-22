"use client";

// Inline error shown inside a modal (e.g. the server's INVALID_EXTRA_FIELDS message).
export default function ErrorText({ message }) {
  if (!message) return null;
  return (
    <div role="alert" style={{ color: "#DC2626", fontSize: 12, fontWeight: 600 }}>
      {message}
    </div>
  );
}
