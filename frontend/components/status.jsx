// Display names and pill classes (workiya-ui.css) for activity and review statuses.
// Every status shows a text label, never colour alone.

export const ACTIVITY_STATUS = {
  Pending: { label: "Pending", pill: "wk-pill wk-pill--pending" },
  InProgress: { label: "In progress", pill: "wk-pill wk-pill--inprogress" },
  Completed: { label: "Completed", pill: "wk-pill wk-pill--completed" },
  Cancelled: { label: "Cancelled", pill: "wk-pill wk-pill--cancelled" },
  Missed: { label: "Missed", pill: "wk-pill wk-pill--missed" },
};

// Review "Pending" reads "Awaiting review" so it is not confused with activity "Pending".
export const REVIEW_STATUS = {
  Pending: { label: "Awaiting review", pill: "wk-pill wk-pill--review" },
  Approved: { label: "Approved", pill: "wk-pill wk-pill--approved" },
  Rejected: { label: "Rejected", pill: "wk-pill wk-pill--rejected" },
};

export function StatusPill({ status, map = ACTIVITY_STATUS }) {
  const meta = map[status] ?? { label: status, pill: "wk-pill" };
  return <span className={meta.pill}>{meta.label}</span>;
}
