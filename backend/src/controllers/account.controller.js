const accountService = require("../services/account.service");
const assignmentService = require("../services/accountAssignment.service");
const { ok } = require("../utils/apiResponse");

function requestContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: (req.get("user-agent") || "").slice(0, 500),
  };
}

function accountId(req) {
  return req.validated.params.id;
}

// GET /api/v1/accounts
async function list(req, res) {
  return ok(res, await accountService.list(req.user, req.validated.query));
}

// GET /api/v1/accounts/:id
async function getById(req, res) {
  return ok(res, await accountService.getById(req.user, accountId(req)));
}

// POST /api/v1/accounts
async function create(req, res) {
  const account = await accountService.create(req.user, req.body, requestContext(req));
  return ok(res, account, "Account created.", 201);
}

// PUT /api/v1/accounts/:id
async function update(req, res) {
  const account = await accountService.update(
    req.user,
    accountId(req),
    req.body,
    requestContext(req),
  );
  return ok(res, account, "Account updated.");
}

// PATCH /api/v1/accounts/:id/status
async function setStatus(req, res) {
  const { isActive } = req.body;
  const account = await accountService.setStatus(
    req.user,
    accountId(req),
    isActive,
    requestContext(req),
  );
  return ok(res, account, isActive ? "Account activated." : "Account deactivated.");
}

// DELETE /api/v1/accounts/:id (soft delete)
async function remove(req, res) {
  await accountService.remove(req.user, accountId(req), requestContext(req));
  return ok(res, null, "Account deleted.");
}

// GET /api/v1/accounts/:id/assignments
async function listAssignments(req, res) {
  return ok(res, await assignmentService.list(req.user, accountId(req)));
}

// PUT /api/v1/accounts/:id/assignments
async function replaceAssignments(req, res) {
  const assignments = await assignmentService.replace(
    req.user,
    accountId(req),
    req.body.assignments,
    requestContext(req),
  );
  return ok(res, assignments, "Assignments saved.");
}

// POST /api/v1/accounts/assignments/transfer
async function transferAssignments(req, res) {
  const result = await assignmentService.transfer(req.user, req.body, requestContext(req));
  return ok(res, result, `${result.moved} account(s) transferred.`);
}

module.exports = {
  list,
  getById,
  create,
  update,
  setStatus,
  remove,
  listAssignments,
  replaceAssignments,
  transferAssignments,
};
