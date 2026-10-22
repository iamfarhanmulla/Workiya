"use client";

import { getInitials, getDisplayName } from "@/hooks/useCurrentUser";
import { SectionTitle } from "./FormBits";

const PROFILE_FIELDS = [
  { id: "stg-first-name", label: "First Name", key: "firstName" },
  { id: "stg-last-name", label: "Last Name", key: "lastName" },
  { id: "stg-email", label: "Email Address", key: "email" },
  { id: "stg-phone", label: "Phone Number", key: "phoneNumber" },
];

const AVATAR_STYLE = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: "linear-gradient(135deg,#1E3A8A,#3B5FCF)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#fff",
  fontSize: 22,
  fontWeight: 700,
};

const LINK_BUTTON_STYLE = {
  marginTop: 6,
  fontSize: 12,
  color: "#1E3A8A",
  fontWeight: 600,
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

function ProfileHeader({ user }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "12px 0",
    }}
    >
      <div style={AVATAR_STYLE}>{getInitials(user)}</div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>
          {getDisplayName(user)}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8" }}>{user?.email || ""}</div>
        <button type="button" style={LINK_BUTTON_STYLE}>Change Avatar</button>
      </div>
    </div>
  );
}

export default function ProfileSection({ user }) {
  return (
    <div className="stg-section" style={{ "--stg-du": "0.05s" }}>
      <SectionTitle icon="person" color="#1E3A8A">Profile Information</SectionTitle>
      <ProfileHeader user={user} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {PROFILE_FIELDS.map((f) => (
          <div className="co-form-group" key={f.id}>
            <label className="co-form-label" htmlFor={f.id}>{f.label}</label>
            <input
              id={f.id}
              className="stg-input"
              style={{ width: "100%" }}
              defaultValue={user?.[f.key] || ""}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
