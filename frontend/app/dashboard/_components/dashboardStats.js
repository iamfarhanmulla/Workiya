// Pure helpers for the dashboard ("_components" is private: no route).
import { STATUSES } from "../activities/_components/activityConfig";

// The browser's local calendar day as an ISO UTC range, for the API's
// dateFrom/dateTo filter on DueAtUtc.
export function dayRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  end.setMilliseconds(-1);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

// Counts per status. "Planned" leaves out cancelled activities, so a cancelled
// visit does not lower anyone's completion rate.
export function summarize(items) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  items.forEach((a) => {
    if (a.status in byStatus) byStatus[a.status] += 1;
  });
  const planned = items.length - byStatus.Cancelled;
  const completion = planned ? Math.round((byStatus.Completed / planned) * 100) : 0;
  return { byStatus, planned, completion };
}

// One row per assignee: planned, done and missed today, best completion first.
export function byRep(items) {
  const reps = new Map();
  items.forEach((a) => {
    if (a.status === "Cancelled") return;
    const key = a.assignedTo ?? "unassigned";
    const rep = reps.get(key) ?? {
      id: key, name: a.assignedToName || "Unassigned", planned: 0, done: 0, missed: 0,
    };
    rep.planned += 1;
    if (a.status === "Completed") rep.done += 1;
    if (a.status === "Missed") rep.missed += 1;
    reps.set(key, rep);
  });
  return [...reps.values()]
    .map((r) => ({ ...r, pct: Math.round((r.done / r.planned) * 100) }))
    .sort((a, b) => b.pct - a.pct || b.planned - a.planned || a.name.localeCompare(b.name));
}

// Meter colour for a completion percentage.
export function completionTone(pct) {
  if (pct >= 85) return "success";
  if (pct >= 60) return "warning";
  return "danger";
}
