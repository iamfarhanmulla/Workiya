"use client";

import Link from "next/link";
import { StatusPill } from "@/components/status";
import { fmtTime, isOverdue } from "../activities/_components/activityConfig";
import { summarize } from "./dashboardStats";
import { useTodayActivities } from "./useDashboardData";
import { LoadError, Meter, SkeletonRows } from "./DashboardParts";

const byDueTime = (a, b) => new Date(a.dueAtUtc) - new Date(b.dueAtUtc);

function DayItem({ activity }) {
  const late = isOverdue(activity);
  return (
    <li className="wk-list-row">
      <span className={`wk-dash-time${late ? " wk-dash-time--late" : ""}`}>
        {fmtTime(activity.dueAtUtc) || "—"}
      </span>
      <div className="wk-list-main">
        <div className="wk-person-name">{activity.accountName || activity.title}</div>
        <div className="wk-person-meta">
          {[activity.activityTypeName, activity.title, late ? "overdue" : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <StatusPill status={activity.status} />
    </li>
  );
}

// A field rep's view: today's own activities in time order.
export default function MyDay({ t }) {
  const today = useTodayActivities();
  const { byStatus, planned, completion } = summarize(today.items);
  const plural = t("activity.plural").toLowerCase();

  if (today.failed) return <LoadError what={`today's ${plural}`} onRetry={today.reload} />;
  if (today.loading) return <SkeletonRows rows={5} />;

  return (
    <section className="wk-card" aria-labelledby="myday-title">
      <div className="wk-card-hd">
        <div>
          <h2 className="wk-card-title" id="myday-title">{`Today's ${plural}`}</h2>
          <div className="wk-card-sub">{`${byStatus.Completed} of ${planned} done`}</div>
        </div>
        <Link href="/dashboard/activities" className="wk-btn wk-btn--secondary wk-btn--sm">
          {`All my ${plural}`}
        </Link>
      </div>
      <div className="wk-card-bd" style={{ paddingBottom: 0 }}>
        <Meter pct={completion} label={`${completion}% of today done`} />
      </div>
      {today.items.length ? (
        <ul className="wk-list">
          {[...today.items].sort(byDueTime).map((a) => <DayItem key={a.id} activity={a} />)}
        </ul>
      ) : (
        <div className="wk-empty">
          <div className="wk-empty-title">{`No ${plural} planned today`}</div>
          <div className="wk-empty-text">
            Your manager hasn&apos;t planned anything for today yet.
          </div>
        </div>
      )}
    </section>
  );
}
