const db = require("../config/db");
const visitPlanRepository = require("../repositories/visitPlan.repository");
const auditService = require("./audit.service");
const AppError = require("../utils/AppError");
const { requireCompanyId } = require("./companyContext");
const { monthRange, workingDays, spreadVisits } = require("./planDates");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");

// Company, its time zone and the month range; past months cannot be planned.
async function planContext(user, body) {
  const companyId = requireCompanyId(user, body.companyId);
  const clock = await visitPlanRepository.companyClock(companyId);
  if (!clock) throw new AppError(404, ERROR_CODES.NOT_FOUND, "Company not found.");
  if (body.month < clock.today.slice(0, 7)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      "Choose the current month or a future month.",
    );
  }
  return {
    companyId, timeZone: clock.time_zone, today: clock.today, range: monthRange(body.month),
  };
}

// The visit type for planned visits: the one given, or the company's only active type.
async function resolveActivityType(companyId, activityTypeId) {
  const types = await visitPlanRepository.activeActivityTypes(companyId);
  if (activityTypeId) {
    const match = types.find((type) => type.id === activityTypeId);
    if (!match) {
      throw new AppError(
        400,
        ERROR_CODES.CROSS_COMPANY_REFERENCE,
        "Visit type not found for this company.",
      );
    }
    return match;
  }
  if (types.length === 1) return types[0];
  const message = types.length ? "Choose a visit type." : "Create a visit type in Settings first.";
  throw new AppError(400, ERROR_CODES.VALIDATION_FAILED, message);
}

// rows -> one item per rep-account with the dates still to create. Visits a rep already has
// for the account that month count towards the target, so nothing is ever planned twice.
function buildPlan(rows, days) {
  const byRep = new Map();
  rows.forEach((row) => {
    const list = byRep.get(row.user_id) || [];
    list.push(row);
    byRep.set(row.user_id, list);
  });
  const items = [];
  byRep.forEach((repRows) => {
    const needs = repRows.map((row) => ({
      key: row.account_id, count: Math.max(0, row.visits_per_month - row.existing),
    }));
    const dates = spreadVisits(days, needs);
    repRows.forEach((row) => items.push({
      accountId: row.account_id,
      accountName: row.account_name,
      userId: row.user_id,
      userName: row.user_name,
      visitsPerMonth: row.visits_per_month,
      existing: row.existing,
      toCreate: dates.get(row.account_id).length,
      dates: dates.get(row.account_id),
    }));
  });
  return items;
}

function totalsOf(items) {
  return {
    reps: new Set(items.map((item) => item.userId)).size,
    accounts: new Set(items.map((item) => item.accountId)).size,
    alreadyPlanned: items.reduce((sum, item) => sum + item.existing, 0),
    toCreate: items.reduce((sum, item) => sum + item.toCreate, 0),
  };
}

async function preview(user, body) {
  const ctx = await planContext(user, body);
  const type = await resolveActivityType(ctx.companyId, body.activityTypeId);
  const rows = await visitPlanRepository.coverageNeeds(db, { ...ctx, ...ctx.range });
  const days = workingDays(body.month, ctx.today);
  const items = buildPlan(rows, days);
  return {
    month: body.month,
    timeZone: ctx.timeZone,
    workingDays: days.length,
    activityType: { id: type.id, name: type.name },
    items,
    totals: totalsOf(items),
  };
}

function toInsertPlan(ctx, type, user, items) {
  const planned = items.flatMap((item) => item.dates.map((date) => ({ item, date })));
  return {
    companyId: ctx.companyId,
    activityTypeId: type.id,
    userId: user.id,
    timeZone: ctx.timeZone,
    planMonth: ctx.range.start,
    accountIds: planned.map(({ item }) => item.accountId),
    assignedTos: planned.map(({ item }) => item.userId),
    dueDates: planned.map(({ date }) => date),
    titles: planned.map(({ item }) => `Visit: ${item.accountName}`.slice(0, 300)),
  };
}

// Recomputed inside the transaction under a per-company-and-month lock, so the result always
// reflects what exists at that moment and double clicks cannot create duplicates.
async function generate(user, body, requestCtx) {
  const ctx = await planContext(user, body);
  const type = await resolveActivityType(ctx.companyId, body.activityTypeId);
  const createdIds = await db.withTransaction(async (tx) => {
    await visitPlanRepository.lockPlan(tx, ctx.companyId, ctx.range.start);
    const rows = await visitPlanRepository.coverageNeeds(tx, { ...ctx, ...ctx.range });
    const items = buildPlan(rows, workingDays(body.month, ctx.today));
    const plan = toInsertPlan(ctx, type, user, items);
    return plan.accountIds.length ? visitPlanRepository.insertPlanned(tx, plan) : [];
  });
  await auditService.log({
    eventType: AUDIT_EVENTS.VISIT_PLAN_GENERATED,
    entityType: "VisitPlan",
    entityId: `${ctx.companyId}:${body.month}`,
    companyId: ctx.companyId,
    performedBy: user.id,
    newValue: { month: body.month, activityTypeId: type.id, created: createdIds.length },
    ipAddress: requestCtx.ipAddress,
    userAgent: requestCtx.userAgent,
  });
  return { month: body.month, created: createdIds.length };
}

module.exports = { preview, generate, buildPlan };
