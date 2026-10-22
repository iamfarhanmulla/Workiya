// Shared constants and helpers for the Activities page (private "_components" folder,
// so the Next.js App Router adds no route for it).
export const STATUSES = ["Pending", "InProgress", "Completed", "Cancelled", "Missed"];

export const COL_CFG = {
  Pending: {
    label: "PENDING",
    dot: "#F59E0B",
    countBg: "#FEF3C7",
    countColor: "#D97706",
    border: "#FDE68A",
    icon: "pending_actions",
  },
  InProgress: {
    label: "IN PROGRESS",
    dot: "#6366F1",
    countBg: "#EEF2FF",
    countColor: "#4F46E5",
    border: "#C7D2FE",
    icon: "sync",
  },
  Completed: {
    label: "COMPLETED",
    dot: "#10B981",
    countBg: "#D1FAE5",
    countColor: "#059669",
    border: "#6EE7B7",
    icon: "check_circle",
  },
  Cancelled: {
    label: "CANCELLED",
    dot: "#94A3B8",
    countBg: "#F1F5F9",
    countColor: "#64748B",
    border: "#CBD5E1",
    icon: "cancel",
  },
  Missed: {
    label: "MISSED",
    dot: "#EF4444",
    countBg: "#FEE2E2",
    countColor: "#DC2626",
    border: "#FCA5A5",
    icon: "event_busy",
  },
};

export const PRIORITY_STYLE = {
  High: { bg: "#FEE2E2", color: "#DC2626" },
  Medium: { bg: "#FEF3C7", color: "#D97706" },
  Low: { bg: "#D1FAE5", color: "#059669" },
};

export const REVIEW_STYLE = {
  Pending: { bg: "#FEF3C7", color: "#D97706" },
  Approved: { bg: "#D1FAE5", color: "#059669" },
  Rejected: { bg: "#FEE2E2", color: "#DC2626" },
};

export const PILL = {
  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
};

const EMPLOYEE_MOVES = {
  Pending: [{ status: "InProgress", label: "Start" }],
  InProgress: [{ status: "Pending", label: "Back to Pending" }],
};

export function initials(name = "") {
  return (name || "").split(" ").map((w) => w[0]).join("").toUpperCase()
    .slice(0, 2) || "?";
}

export function fmtDate(iso) {
  if (!iso) return null;
  const options = { day: "numeric", month: "short", year: "numeric" };
  return new Date(iso).toLocaleDateString("en-IN", options);
}

export function fmtTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function isOverdue(activity) {
  if (activity.status !== "Pending" && activity.status !== "InProgress") return false;
  return !!activity.dueAtUtc && new Date(activity.dueAtUtc) < new Date();
}

// "2026-10-21T14:30" (local time from <input type="datetime-local">) -> ISO UTC string.
export function localInputToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ISO UTC string -> "YYYY-MM-DDTHH:mm" in the browser's local time zone.
export function isoToLocalInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isOwnActivity(activity, user) {
  return !!user && activity.assignedTo === user.id;
}

export function canSubmitReport(activity, user) {
  return isOwnActivity(activity, user)
    && (activity.status === "Pending" || activity.status === "InProgress");
}

// Status moves offered to the viewer: staff may set any other status; an EMPLOYEE may
// only start their own activity or put it back to Pending (completing it is by report).
export function statusMoves(activity, user, isStaff) {
  if (isStaff) {
    return STATUSES.filter((s) => s !== activity.status)
      .map((status) => ({ status, label: COL_CFG[status].label }));
  }
  if (!isOwnActivity(activity, user)) return [];
  return EMPLOYEE_MOVES[activity.status] || [];
}
