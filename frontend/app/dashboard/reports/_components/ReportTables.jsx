"use client";

import StatTile from "@/components/StatTile";
import { Meter, EmptyState } from "@/components/DataStates";
import { shortDay } from "@/lib/months";

function rate(value) {
  return value == null ? "—" : `${value}%`;
}

function tone(value) {
  if (value == null) return undefined;
  if (value >= 80) return "success";
  return value >= 50 ? "warning" : "danger";
}

function CoverageMeter({ value, showLabel = false }) {
  return (
    <Meter
      pct={Math.min(value || 0, 100)}
      tone={tone(value)}
      label={`Coverage ${rate(value)}`}
      showLabel={showLabel}
    />
  );
}

export function CoverageKpis({ totals }) {
  return (
    <div className="wk-kpis">
      <StatTile icon="flag" label="Planned (target)" value={totals.target || totals.scheduled} />
      <StatTile icon="task_alt" label="Completed" value={totals.completed} />
      <StatTile
        icon="event_busy"
        label="Missed"
        value={totals.missed}
        tone={totals.missed ? "danger" : undefined}
      />
      <StatTile icon="percent" label="Coverage" value={rate(totals.coveragePercent)}>
        <CoverageMeter value={totals.coveragePercent} />
      </StatTile>
    </div>
  );
}

const REP_COLUMNS = [
  "Rep", "Accounts", "Target", "Completed", "Missed", "Open", "Coverage", "Approved",
];

export function RepCoverageTable({ reps }) {
  if (reps.length === 0) {
    return (
      <EmptyState
        icon="groups"
        title="No visits yet"
        text="Assign reps to accounts and generate a plan."
      />
    );
  }
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>{REP_COLUMNS.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {reps.map((rep) => (
            <tr key={rep.userId}>
              <td>{rep.userName}</td>
              <td>{rep.accounts}</td>
              <td>{rep.target || rep.scheduled}</td>
              <td>{rep.completed}</td>
              <td>{rep.missed}</td>
              <td>{rep.open}</td>
              <td><CoverageMeter value={rep.coveragePercent} showLabel /></td>
              <td>{rate(rep.approvalPercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function NotVisitedTable({ rows, accountLabel }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="verified"
        title="Everyone was visited"
        text="Every assigned account has at least one completed visit this month."
      />
    );
  }
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">{accountLabel}</th>
            <th scope="col">Rep</th>
            <th scope="col">Per month</th>
            <th scope="col">Last visit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.userId}-${row.accountId}`}>
              <td>{row.accountName}</td>
              <td>{row.userName}</td>
              <td>{row.visitsPerMonth ?? "—"}</td>
              <td>{row.lastVisitAt ? shortDay(row.lastVisitAt) : "Never"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendColumn({ week, max }) {
  const title = `Week of ${shortDay(week.weekStart)}: `
    + `${week.completed} completed, ${week.missed} missed`;
  return (
    <div className="wk-trend-col" title={title}>
      <div className="wk-trend-stack">
        <span
          className="wk-trend-bar wk-trend-bar--missed"
          style={{ height: `${(100 * week.missed) / max}%` }}
        />
        <span
          className="wk-trend-bar wk-trend-bar--done"
          style={{ height: `${(100 * week.completed) / max}%` }}
        />
      </div>
      <span className="wk-trend-label">{shortDay(week.weekStart)}</span>
    </div>
  );
}

// Completed (green) and missed (red) per week, scaled to the busiest week.
export function TrendBars({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.completed + w.missed));
  return (
    <div className="wk-trend" role="img" aria-label="Completed and missed visits per week">
      {weeks.map((week) => <TrendColumn key={week.weekStart} week={week} max={max} />)}
    </div>
  );
}
