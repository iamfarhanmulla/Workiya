"use client";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTerminology } from "@/hooks/useTerminology";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/DataStates";
import { SETTINGS_ROLES } from "@/components/navConfig";
import FieldsAndLabels from "./_components/FieldsAndLabels";

function SettingsNav({ activity }) {
  const links = [
    ["#labels", "Labels", "translate"],
    ["#custom-fields", "Custom fields", "dynamic_form"],
    ["#visit-types", `${activity} types`, "fact_check"],
  ];
  return (
    <nav className="wk-settings-nav" aria-label="Settings sections">
      {links.map(([href, label, icon]) => (
        <a key={href} href={href}>
          <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}

// Company settings for admins: labels, custom fields and activity types.
export default function SettingsPage() {
  const user = useCurrentUser();
  const { t } = useTerminology();
  const canEdit = SETTINGS_ROLES.includes(user?.roleCode);
  const activity = t("activity.singular");

  return (
    <div className="wk-app">
      <div className="wk-main">
        <PageHeader
          title="Settings"
          sub={`Labels, custom fields and ${activity.toLowerCase()} types for your company`}
        />
        {canEdit && (
          <div className="wk-settings">
            <SettingsNav activity={activity} />
            <div className="wk-settings-body"><FieldsAndLabels /></div>
          </div>
        )}
        {user && !canEdit && (
          <section className="wk-card">
            <EmptyState
              icon="lock"
              title="Company settings are managed by your admin"
              text="Ask an admin if a label, field or type needs to change."
            />
          </section>
        )}
      </div>
    </div>
  );
}
