"use client";

import { SectionTitle } from "./FormBits";

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

function Toggle({
  id, label, checked, onChange,
}) {
  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-slider" />
    </label>
  );
}

function Select({ options }) {
  return (
    <select className="co-filter-select">
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
}

export function SecuritySection() {
  return (
    <div className="stg-section" style={{ "--stg-du": "0.1s" }}>
      <SectionTitle icon="lock" color="#8B5CF6">Security</SectionTitle>
      <Row label="Password" desc="Last changed 30 days ago">
        <button type="button" className="btn btn-outline btn-sm">Change Password</button>
      </Row>
      <Row label="Two-Factor Authentication" desc="Add extra security to your account">
        <button type="button" className="btn btn-primary btn-sm">
          <span className="material-symbols-outlined">shield</span>
          Enable 2FA
        </button>
      </Row>
      <Row label="Active Sessions" desc="2 devices currently logged in">
        <button type="button" className="btn btn-danger btn-sm">Revoke All</button>
      </Row>
    </div>
  );
}

const NOTIFICATION_ROWS = [
  ["email", "Email Notifications", "Receive updates via email"],
  ["push", "Push Notifications", "Browser and mobile push alerts"],
  ["newTask", "New Task Alerts", "Alert when a new task is assigned"],
  ["weekly", "Weekly Summary Report", "Receive weekly analytics digest on Monday"],
];

export function NotificationsSection({ notifications, onChange }) {
  return (
    <div className="stg-section" style={{ "--stg-du": "0.15s" }}>
      <SectionTitle icon="notifications" color="#F59E0B">Notifications</SectionTitle>
      {NOTIFICATION_ROWS.map(([key, label, desc]) => (
        <Row key={key} label={label} desc={desc}>
          <Toggle
            id={`stg-notify-${key}`}
            label={label}
            checked={notifications[key]}
            onChange={(value) => onChange(key, value)}
          />
        </Row>
      ))}
    </div>
  );
}

export function PlatformSection() {
  return (
    <div className="stg-section" style={{ "--stg-du": "0.2s" }}>
      <SectionTitle icon="settings" color="#06B6D4">Platform Configuration</SectionTitle>
      <Row label="Default Timezone" desc="Used for task deadlines and reports">
        <Select options={[
          "Asia/Kolkata (IST, UTC+5:30)", "America/New_York (EST)", "Europe/London (GMT)",
          "Asia/Dubai (GST, UTC+4)",
        ]}
        />
      </Row>
      <Row label="Default Language" desc="Interface language">
        <Select options={["English", "Hindi", "Arabic", "German"]} />
      </Row>
      <Row label="Date Format" desc="How dates appear across the platform">
        <Select options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} />
      </Row>
      <Row label="Checkin Radius (meters)" desc="Max GPS radius to allow employee check-in">
        <input className="stg-input" defaultValue="100" style={{ width: 120 }} />
      </Row>
    </div>
  );
}

export function DangerZoneSection() {
  return (
    <div className="stg-section" style={{ "--stg-du": "0.25s", borderColor: "#FEE2E2" }}>
      <SectionTitle icon="warning" color="#EF4444" style={{ color: "#EF4444" }}>
        Danger Zone
      </SectionTitle>
      <Row label="Export All Data" desc="Download a complete backup of platform data">
        <button type="button" className="btn btn-outline btn-sm">
          <span className="material-symbols-outlined">download</span>
          Export
        </button>
      </Row>
      <Row label="Reset Platform" desc="This will clear all data. Cannot be undone.">
        <button type="button" className="btn btn-danger btn-sm">
          <span className="material-symbols-outlined">delete_forever</span>
          Reset
        </button>
      </Row>
    </div>
  );
}

export function SaveBar({ saved, onSave }) {
  return (
    <div style={{
      display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4,
    }}
    >
      <button type="button" className="btn btn-outline">Discard Changes</button>
      <button type="button" className="stg-save-btn" onClick={onSave}>
        <span className="material-symbols-outlined">{saved ? "check" : "save"}</span>
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
