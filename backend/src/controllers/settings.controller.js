const settingsService = require("../services/settings.service");
const activityTypeService = require("../services/activityTypeSettings.service");
const { requireCompanyId } = require("../services/companyContext");
const { ok } = require("../utils/apiResponse");

// Only SUPER_ADMIN may name a company: ?companyId on reads, body or query on writes.
function companyOf(req) {
  const query = (req.validated && req.validated.query) || req.query;
  const bodyCompanyId = req.body ? req.body.companyId : undefined;
  return requireCompanyId(req.user, bodyCompanyId ?? query.companyId);
}

function contextOf(req) {
  return {
    companyId: companyOf(req),
    userId: req.user.id,
    ip: req.ip,
    userAgent: (req.get("user-agent") || "").slice(0, 500),
  };
}

function idOf(req) {
  return req.validated.params.id;
}

async function getTerminology(req, res) {
  return ok(res, await settingsService.getTerminology(companyOf(req)));
}

async function updateTerminology(req, res) {
  const labels = await settingsService.updateTerminology(contextOf(req), req.body.labels);
  return ok(res, labels, "Labels saved.");
}

async function listCustomFields(req, res) {
  const { entityType, includeInactive } = req.validated.query;
  const filters = { entityType, includeInactive };
  const fields = await settingsService.listCustomFields(companyOf(req), filters);
  return ok(res, fields);
}

async function createCustomField(req, res) {
  const field = await settingsService.createCustomField(contextOf(req), req.body);
  return ok(res, field, "Field created.", 201);
}

async function updateCustomField(req, res) {
  const field = await settingsService.updateCustomField(contextOf(req), idOf(req), req.body);
  return ok(res, field, "Field updated.");
}

async function deleteCustomField(req, res) {
  await settingsService.deleteCustomField(contextOf(req), idOf(req));
  return ok(res, null, "Field deleted.");
}

async function listActivityTypes(req, res) {
  const { includeInactive } = req.validated.query;
  return ok(res, await activityTypeService.listActivityTypes(companyOf(req), { includeInactive }));
}

async function createActivityType(req, res) {
  const type = await activityTypeService.createActivityType(contextOf(req), req.body);
  return ok(res, type, "Activity type created.", 201);
}

async function updateActivityType(req, res) {
  const type = await activityTypeService.updateActivityType(contextOf(req), idOf(req), req.body);
  return ok(res, type, "Activity type updated.");
}

async function deleteActivityType(req, res) {
  await activityTypeService.deleteActivityType(contextOf(req), idOf(req));
  return ok(res, null, "Activity type deleted.");
}

module.exports = {
  getTerminology,
  updateTerminology,
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  listActivityTypes,
  createActivityType,
  updateActivityType,
  deleteActivityType,
};
