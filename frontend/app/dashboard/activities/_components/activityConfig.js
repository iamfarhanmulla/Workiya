// Shared constants and helpers for the Activities page (private "_components" folder,
// so the Next.js App Router adds no route for it).
import { ACTIVITY_STATUS } from "@/components/status";

export const STATUSES = ["Pending", "InProgress", "Completed", "Cancelled", "Missed"];

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
      .map((status) => ({ status, label: ACTIVITY_STATUS[status].label }));
  }
  if (!isOwnActivity(activity, user)) return [];
  return EMPLOYEE_MOVES[activity.status] || [];
}
