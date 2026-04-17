"use client";

import { useState } from "react";
import { useCurrentUser, getInitials, getDisplayName } from "@/hooks/useCurrentUser";

export default function SettingsPage() {
  const user = useCurrentUser();
  const [notifications, setNotifications] = useState({ email: true, push: true, weekly: false, newTask: true });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function Row({ label, desc, children }) {
    return (
      <div className="stg-row">
        <div>
          <div className="stg-row-label">{label}</div>
          {desc && <div className="stg-row-desc">{desc}</div>}
        </div>
        {children}
      </div>
    );
  }

  function Toggle({ checked, onChange }) {
    return (
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    );
  }

  return (
    <div className="stg-page">
      {/* Header */}
      <div className="dash-fade-up" style={{ "--du": "0s" }}>
        <div className="breadcrumb">
          <span className="material-symbols-outlined">home</span>
          <span className="material-symbols-outlined">chevron_right</span>
          <span className="breadcrumb-active">Settings</span>
        </div>
        <h1 className="stg-title">Settings</h1>
        <p className="stg-sub">Manage your platform preferences and account configuration</p>
      </div>

      {/* Profile */}
      <div className="stg-section" style={{ "--stg-du": "0.05s" }}>
        <div className="stg-section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#1E3A8A", fontVariationSettings: "'FILL' 1" }}>person</span>
            Profile Information
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: "12px 0" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#1E3A8A,#3B5FCF)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 700 }}>
            {getInitials(user)}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{getDisplayName(user)}</div>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>{user?.email || ""}</div>
            <button style={{ marginTop: 6, fontSize: 12, color: "#1E3A8A", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Change Avatar
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="co-form-group">
            <label className="co-form-label">First Name</label>
            <input className="stg-input" style={{ width: "100%" }} defaultValue={user?.firstName || ""} />
          </div>
          <div className="co-form-group">
            <label className="co-form-label">Last Name</label>
            <input className="stg-input" style={{ width: "100%" }} defaultValue={user?.lastName || ""} />
          </div>
          <div className="co-form-group">
            <label className="co-form-label">Email Address</label>
            <input className="stg-input" style={{ width: "100%" }} defaultValue={user?.email || ""} />
          </div>
          <div className="co-form-group">
            <label className="co-form-label">Phone Number</label>
            <input className="stg-input" style={{ width: "100%" }} defaultValue={user?.phoneNumber || ""} />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="stg-section" style={{ "--stg-du": "0.1s" }}>
        <div className="stg-section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#8B5CF6", fontVariationSettings: "'FILL' 1" }}>lock</span>
            Security
          </span>
        </div>
        <Row label="Password" desc="Last changed 30 days ago">
          <button className="btn btn-outline btn-sm">Change Password</button>
        </Row>
        <Row label="Two-Factor Authentication" desc="Add extra security to your account">
          <button className="btn btn-primary btn-sm">
            <span className="material-symbols-outlined">shield</span>
            Enable 2FA
          </button>
        </Row>
        <Row label="Active Sessions" desc="2 devices currently logged in">
          <button className="btn btn-danger btn-sm">Revoke All</button>
        </Row>
      </div>

      {/* Notifications */}
      <div className="stg-section" style={{ "--stg-du": "0.15s" }}>
        <div className="stg-section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#F59E0B", fontVariationSettings: "'FILL' 1" }}>notifications</span>
            Notifications
          </span>
        </div>
        <Row label="Email Notifications" desc="Receive updates via email">
          <Toggle checked={notifications.email} onChange={v => setNotifications(n => ({ ...n, email: v }))} />
        </Row>
        <Row label="Push Notifications" desc="Browser and mobile push alerts">
          <Toggle checked={notifications.push} onChange={v => setNotifications(n => ({ ...n, push: v }))} />
        </Row>
        <Row label="New Task Alerts" desc="Alert when a new task is assigned">
          <Toggle checked={notifications.newTask} onChange={v => setNotifications(n => ({ ...n, newTask: v }))} />
        </Row>
        <Row label="Weekly Summary Report" desc="Receive weekly analytics digest on Monday">
          <Toggle checked={notifications.weekly} onChange={v => setNotifications(n => ({ ...n, weekly: v }))} />
        </Row>
      </div>

      {/* Platform */}
      <div className="stg-section" style={{ "--stg-du": "0.2s" }}>
        <div className="stg-section-title">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#06B6D4", fontVariationSettings: "'FILL' 1" }}>settings</span>
            Platform Configuration
          </span>
        </div>
        <Row label="Default Timezone" desc="Used for task deadlines and reports">
          <select className="co-filter-select">
            <option>Asia/Kolkata (IST, UTC+5:30)</option>
            <option>America/New_York (EST)</option>
            <option>Europe/London (GMT)</option>
            <option>Asia/Dubai (GST, UTC+4)</option>
          </select>
        </Row>
        <Row label="Default Language" desc="Interface language">
          <select className="co-filter-select">
            <option>English</option>
            <option>Hindi</option>
            <option>Arabic</option>
            <option>German</option>
          </select>
        </Row>
        <Row label="Date Format" desc="How dates appear across the platform">
          <select className="co-filter-select">
            <option>DD/MM/YYYY</option>
            <option>MM/DD/YYYY</option>
            <option>YYYY-MM-DD</option>
          </select>
        </Row>
        <Row label="Checkin Radius (meters)" desc="Max GPS radius to allow employee check-in">
          <input className="stg-input" defaultValue="100" style={{ width: 120 }} />
        </Row>
      </div>

      {/* Danger Zone */}
      <div className="stg-section" style={{ "--stg-du": "0.25s", borderColor: "#FEE2E2" }}>
        <div className="stg-section-title" style={{ color: "#EF4444" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: "#EF4444", fontVariationSettings: "'FILL' 1" }}>warning</span>
            Danger Zone
          </span>
        </div>
        <Row label="Export All Data" desc="Download a complete backup of platform data">
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">download</span>
            Export
          </button>
        </Row>
        <Row label="Reset Platform" desc="This will clear all data. Cannot be undone.">
          <button className="btn btn-danger btn-sm">
            <span className="material-symbols-outlined">delete_forever</span>
            Reset
          </button>
        </Row>
      </div>

      {/* Save bar */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
        <button className="btn btn-outline">Discard Changes</button>
        <button className="stg-save-btn" onClick={handleSave}>
          <span className="material-symbols-outlined">{saved ? "check" : "save"}</span>
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
