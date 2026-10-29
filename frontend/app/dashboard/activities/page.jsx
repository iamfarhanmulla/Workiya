"use client";

import { useState } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTerminology } from "@/hooks/useTerminology";
import ActivityHeader from "./_components/ActivityHeader";
import ActivityToolbar from "./_components/ActivityToolbar";
import ActivityContent from "./_components/ActivityContent";
import ActivityModals from "./_components/ActivityModals";
import useActivityActions from "./_components/useActivityActions";
import { useActivities, usePickers } from "./_components/useActivitiesData";

const INITIAL_FILTERS = { search: "", status: "all", priority: "all" };

function useLabels() {
  const { t } = useTerminology();
  return {
    activity: t("activity.singular"),
    activities: t("activity.plural"),
    account: t("account.singular"),
    accounts: t("account.plural"),
    submission: t("submission.singular"),
    submissions: t("submission.plural"),
  };
}

export default function ActivitiesPage() {
  const { toasts, showToast } = useToast();
  const labels = useLabels();
  const user = useCurrentUser();
  const isStaff = !!user && user.roleCode !== "EMPLOYEE";
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [view, setView] = useState("kanban");
  const data = useActivities(filters);
  const pickers = usePickers(isStaff);
  const actions = useActivityActions({ labels, showToast, reload: data.reload });
  const visible = data.items.filter(
    (a) => filters.priority === "all" || a.priority === filters.priority,
  );
  const ctx = {
    labels, user, isStaff, actions, showToast,
  };

  return (
    <div className="wk-app">
      <div className="wk-main">
        <ToastContainer toasts={toasts} />
        <ActivityHeader
          labels={labels}
          activities={data.items}
          total={data.total}
          isStaff={isStaff}
          onAdd={actions.openAdd}
          plan={{ user, notify: showToast, reload: data.reload }}
        />
        <ActivityToolbar
          filters={filters}
          onFilterChange={setFilters}
          view={view}
          onViewChange={setView}
          isStaff={isStaff}
          plural={labels.activities}
        />
        <ActivityContent view={view} data={data} activities={visible} ctx={ctx} />
        <ActivityModals pickers={pickers} ctx={ctx} />
      </div>
    </div>
  );
}
