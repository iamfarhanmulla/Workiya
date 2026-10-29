const crypto = require("node:crypto");
const visitPlanService = require("../services/visitPlan.service");
const missedVisitsService = require("../services/missedVisits.service");
const reportService = require("../services/report.service");
const config = require("../config/env");
const { ok, fail } = require("../utils/apiResponse");
const { isSuperAdmin } = require("../services/tenantScope");
const { ERROR_CODES } = require("../constants/errorCodes");

function requestContext(req) {
  return { ipAddress: req.ip, userAgent: (req.get("user-agent") || "").slice(0, 500) };
}

// POST /api/v1/visit-plans/preview
async function preview(req, res) {
  return ok(res, await visitPlanService.preview(req.user, req.body));
}

// POST /api/v1/visit-plans
async function generate(req, res) {
  const result = await visitPlanService.generate(req.user, req.body, requestContext(req));
  return ok(res, result, `${result.created} planned visit(s) created.`, 201);
}

// POST /api/v1/visit-plans/mark-missed  ("Run now"; SUPER_ADMIN without companyId = all)
async function markMissed(req, res) {
  const companyId = isSuperAdmin(req.user) ? (req.body.companyId ?? null) : req.user.companyId;
  const result = await missedVisitsService.markMissed({
    companyId, performedBy: req.user.id, requestCtx: requestContext(req),
  });
  return ok(res, result, `${result.marked} visit(s) marked as missed.`);
}

// GET /api/v1/reports/coverage
async function coverage(req, res) {
  return ok(res, await reportService.coverage(req.user, req.validated.query));
}

// GET /api/v1/reports/trend
async function trend(req, res) {
  return ok(res, await reportService.trend(req.user, req.validated.query));
}

function secretMatches(header, secret) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(String(header || ""));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

// GET /api/v1/jobs/missed-visits (Vercel Cron). Without CRON_SECRET the job does not exist.
async function cronMissedVisits(req, res) {
  if (!config.cronSecret) return fail(res, 404, ERROR_CODES.NOT_FOUND, "Resource not found.");
  if (!secretMatches(req.get("authorization"), config.cronSecret)) {
    return fail(res, 401, ERROR_CODES.AUTH_REQUIRED, "Authentication required.");
  }
  return ok(res, await missedVisitsService.markMissed(), "Missed visits job finished.");
}

module.exports = {
  preview, generate, markMissed, coverage, trend, cronMissedVisits,
};
