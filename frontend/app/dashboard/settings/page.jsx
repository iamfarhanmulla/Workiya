"use client";

import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import ProfileSection from "./_components/ProfileSection";
import FieldsAndLabels from "./_components/FieldsAndLabels";
import {
  DangerZoneSection,
  NotificationsSection,
  PlatformSection,
  SaveBar,
  SecuritySection,
} from "./_components/PreferenceSections";

const SAVED_NOTICE_MS = 2500;

function PageHeader() {
  return (
    <div className="dash-fade-up" style={{ "--du": "0s" }}>
      <div className="breadcrumb">
        <span className="material-symbols-outlined">home</span>
        <span className="material-symbols-outlined">chevron_right</span>
        <span className="breadcrumb-active">Settings</span>
      </div>
      <h1 className="stg-title">Settings</h1>
      <p className="stg-sub">Manage your platform preferences and account configuration</p>
    </div>
  );
}

export default function SettingsPage() {
  const user = useCurrentUser();
  const [notifications, setNotifications] = useState({
    email: true, push: true, weekly: false, newTask: true,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), SAVED_NOTICE_MS);
  };

  return (
    <div className="stg-page">
      <PageHeader />
      <ProfileSection user={user} />
      <SecuritySection />
      <NotificationsSection
        notifications={notifications}
        onChange={(key, value) => setNotifications((n) => ({ ...n, [key]: value }))}
      />
      <PlatformSection />
      <FieldsAndLabels />
      <DangerZoneSection />
      <SaveBar saved={saved} onSave={handleSave} />
    </div>
  );
}
