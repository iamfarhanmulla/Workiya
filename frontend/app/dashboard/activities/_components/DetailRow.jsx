"use client";

const LABEL = {
  fontSize: 11,
  color: "#94A3B8",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

export function SectionTitle({ children }) {
  return (
    <div style={{ ...LABEL, color: "var(--ds-text-2)", fontWeight: 700 }}>{children}</div>
  );
}

// One icon + label + value line of the view panel; renders nothing without a value.
export default function DetailRow({ icon, label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 16, color: "#6366F1", marginTop: 1, flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={LABEL}>{label}</div>
        <div style={{
          fontSize: 13,
          color: "var(--ds-text)",
          fontWeight: 500,
          marginTop: 1,
          whiteSpace: "pre-wrap",
        }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
