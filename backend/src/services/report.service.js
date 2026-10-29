const reportRepository = require("../repositories/report.repository");
const visitPlanRepository = require("../repositories/visitPlan.repository");
const AppError = require("../utils/AppError");
const { requireCompanyId } = require("./companyContext");
const { monthRange, toIso } = require("./planDates");
const { ROLES } = require("../constants/roles");
const { ERROR_CODES } = require("../constants/errorCodes");

const STAFF = new Set([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]);
const COUNTERS = ["target", "accounts", "scheduled", "completed", "missed", "open", "cancelled",
  "approved"];

// Company, its clock, and the rep filter: an EMPLOYEE only ever sees their own numbers.
async function reportScope(user, query) {
  const companyId = requireCompanyId(user, query.companyId);
  const clock = await visitPlanRepository.companyClock(companyId);
  if (!clock) throw new AppError(404, ERROR_CODES.NOT_FOUND, "Company not found.");
  return {
    companyId,
    timeZone: clock.time_zone,
    today: clock.today,
    userId: STAFF.has(user.roleCode) ? null : Number(user.id),
  };
}

function percent(part, whole) {
  return whole > 0 ? Math.round((100 * part) / whole) : null;
}

function withRates(entry) {
  return {
    ...entry,
    coveragePercent: percent(entry.completed, entry.target || entry.scheduled),
    approvalPercent: percent(entry.approved, entry.completed),
  };
}

function mergeByRep(statusRows, targetRows) {
  const reps = new Map();
  const entryFor = (row) => {
    if (!reps.has(row.user_id)) {
      const empty = Object.fromEntries(COUNTERS.map((key) => [key, 0]));
      reps.set(row.user_id, { userId: row.user_id, userName: row.user_name, ...empty });
    }
    return reps.get(row.user_id);
  };
  targetRows.forEach((row) => Object.assign(entryFor(row), {
    target: row.target, accounts: row.accounts,
  }));
  statusRows.forEach((row) => {
    const entry = entryFor(row);
    COUNTERS.slice(2).forEach((key) => {
      entry[key] = row[key];
    });
  });
  return [...reps.values()].map(withRates)
    .sort((a, b) => a.userName.localeCompare(b.userName));
}

function totalsOf(byRep) {
  const sums = Object.fromEntries(COUNTERS.map((key) => [
    key, byRep.reduce((sum, rep) => sum + rep[key], 0),
  ]));
  return withRates(sums);
}

async function coverage(user, query) {
  const scope = await reportScope(user, query);
  const range = monthRange(query.month || scope.today.slice(0, 7));
  const params = { ...scope, start: range.start, end: range.end };
  const [statusRows, targetRows, missing] = await Promise.all([
    reportRepository.statusByRep(params),
    reportRepository.targetsByRep(params),
    reportRepository.notVisited(params),
  ]);
  const byRep = mergeByRep(statusRows, targetRows);
  return {
    month: range.month,
    timeZone: scope.timeZone,
    totals: totalsOf(byRep),
    byRep,
    notVisited: missing.map((row) => ({
      accountId: row.account_id,
      accountName: row.account_name,
      userId: row.user_id,
      userName: row.user_name,
      visitsPerMonth: row.visits_per_month,
      lastVisitAt: row.last_visit_at,
    })),
  };
}

function mondayOf(iso) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date;
}

async function trend(user, query) {
  const scope = await reportScope(user, query);
  const weeks = query.weeks || 8;
  const first = mondayOf(scope.today);
  first.setUTCDate(first.getUTCDate() - 7 * (weeks - 1));
  const rows = await reportRepository.weeklyTrend({ ...scope, from: toIso(first) });
  const byWeek = new Map(rows.map((row) => [row.week_start, row]));
  return Array.from({ length: weeks }, (_, i) => {
    const week = new Date(first);
    week.setUTCDate(first.getUTCDate() + 7 * i);
    const row = byWeek.get(toIso(week));
    return {
      weekStart: toIso(week),
      completed: row ? row.completed : 0,
      missed: row ? row.missed : 0,
    };
  });
}

module.exports = { coverage, trend, mergeByRep };
