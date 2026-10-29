"use client";

import Link from "next/link";
import StatTile from "@/components/StatTile";
import { LoadError, Meter, SkeletonRows } from "@/components/DataStates";
import { fmtDateTime, initials } from "../activities/_components/activityConfig";
import {
  byRep, completionTone, summarize,
} from "./dashboardStats";
import {
  REVIEW_PAGE_SIZE, TODAY_PAGE_SIZE, usePendingReviews, useTodayActivities,
} from "./useDashboardData";

function KpiRow({ stats, reviewsTotal, plural }) {
  const { byStatus, planned, completion } = stats;
  return (
    <div className="wk-kpis">
      <StatTile icon="event_note" label={`Planned ${plural}`} value={planned}>
        <span className="wk-stat-foot">
          {`${byStatus.Pending} pending · ${byStatus.InProgress} in progress`}
        </span>
      </StatTile>
      <StatTile icon="task_alt" label="Completed" value={byStatus.Completed} total={planned}>
        <Meter pct={completion} label={`${completion}% complete`} />
      </StatTile>
      <StatTile icon="rate_review" label="Waiting for review" value={reviewsTotal}>
        <span className="wk-stat-foot"><Link href="/dashboard/activities">Review now</Link></span>
      </StatTile>
      <StatTile
        icon="event_busy"
        label="Missed"
        value={byStatus.Missed}
        tone={byStatus.Missed ? "danger" : undefined}
      >
        <span className="wk-stat-foot">Due today and not done</span>
      </StatTile>
    </div>
  );
}

function RepRow({ rep }) {
  return (
    <tr>
      <td>
        <div className="wk-person">
          <span className="wk-avatar wk-avatar--xs" aria-hidden="true">{initials(rep.name)}</span>
          <span className="wk-person-name">{rep.name}</span>
        </div>
      </td>
      <td className="num">{rep.planned}</td>
      <td className="num">{rep.done}</td>
      <td>
        <Meter pct={rep.pct} tone={completionTone(rep.pct)} label={`${rep.pct}%`} showLabel />
      </td>
      <td className="num">{rep.missed}</td>
    </tr>
  );
}

function RepTable({ reps, plural, repLabel }) {
  if (!reps.length) {
    return (
      <div className="wk-empty">
        <div className="wk-empty-title">{`No ${plural} due today`}</div>
        <div className="wk-empty-text">
          Planned work for today will show here, person by person.
        </div>
      </div>
    );
  }
  return (
    <div className="wk-table-wrap" style={{ borderTop: 0 }}>
      <table className="wk-table">
        <thead>
          <tr>
            <th>{repLabel}</th>
            <th className="num">Planned</th>
            <th className="num">Done</th>
            <th style={{ width: "36%" }}>Completion</th>
            <th className="num">Missed</th>
          </tr>
        </thead>
        <tbody>
          {reps.map((r) => <RepRow key={r.id} rep={r} />)}
        </tbody>
      </table>
    </div>
  );
}

function ReviewQueue({ reviews }) {
  if (reviews.loading) return <SkeletonRows rows={3} />;
  if (reviews.failed) return <LoadError what="reports" onRetry={reviews.reload} />;
  if (!reviews.items.length) {
    return (
      <div className="wk-empty">
        <div className="wk-empty-title">All caught up</div>
        <div className="wk-empty-text">No reports are waiting for review.</div>
      </div>
    );
  }
  return (
    <ul className="wk-list">
      {reviews.items.map((s) => (
        <li key={s.id} className="wk-list-row">
          <span className="wk-avatar wk-avatar--xs" aria-hidden="true">
            {initials(s.submittedByName)}
          </span>
          <div className="wk-list-main">
            <div className="wk-person-name">{s.accountName || s.activityTitle}</div>
            <div className="wk-person-meta">
              {`${s.submittedByName} · ${fmtDateTime(s.submittedAtUtc)}`}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CardHeader({
  id, title, sub, children,
}) {
  return (
    <div className="wk-card-hd">
      <div>
        <h2 className="wk-card-title" id={id}>{title}</h2>
        <div className="wk-card-sub">{sub}</div>
      </div>
      {children}
    </div>
  );
}

export default function StaffDashboard({ t }) {
  const today = useTodayActivities();
  const reviews = usePendingReviews(true);
  const plural = t("activity.plural").toLowerCase();
  const stats = summarize(today.items);
  const more = reviews.total > REVIEW_PAGE_SIZE ? ` (showing newest ${REVIEW_PAGE_SIZE})` : "";

  if (today.failed) {
    return <LoadError what={`today's ${plural}`} onRetry={today.reload} />;
  }

  return (
    <>
      {today.loading
        ? <SkeletonRows rows={1} tiles />
        : <KpiRow stats={stats} reviewsTotal={reviews.total} plural={plural} />}
      {today.total > today.items.length && (
        <div className="wk-banner wk-banner--info" role="status">
          <span className="material-symbols-outlined" aria-hidden="true">info</span>
          <div>{`Counts use the first ${TODAY_PAGE_SIZE} of ${today.total} due today.`}</div>
        </div>
      )}
      <div className="wk-dash-grid">
        <section className="wk-card" aria-labelledby="dash-reps">
          <CardHeader
            id="dash-reps"
            title={`${t("rep.plural")} today`}
            sub="Best completion first"
          />
          {today.loading
            ? <SkeletonRows rows={4} />
            : <RepTable reps={byRep(today.items)} plural={plural} repLabel={t("rep.singular")} />}
        </section>
        <section className="wk-card" aria-labelledby="dash-reviews">
          <CardHeader id="dash-reviews" title="Waiting for review" sub={`Newest first${more}`}>
            <Link href="/dashboard/activities" className="wk-btn wk-btn--ghost wk-btn--sm">
              Open queue
            </Link>
          </CardHeader>
          <ReviewQueue reviews={reviews} />
        </section>
      </div>
    </>
  );
}
