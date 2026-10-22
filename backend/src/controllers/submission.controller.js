const submissionService = require("../services/submission.service");
const { requestContext } = require("./activity.controller");
const { ok } = require("../utils/apiResponse");

async function getAll(req, res) {
  const page = await submissionService.listSubmissions(req.user, req.validated.query);
  return ok(res, page);
}

async function getById(req, res) {
  const submission = await submissionService.getSubmission(req.user, req.validated.params.id);
  return ok(res, submission);
}

// POST /api/v1/activities/:id/submissions
async function create(req, res) {
  const submission = await submissionService.createSubmission(
    requestContext(req),
    req.validated.params.id,
    req.body,
  );
  return ok(res, submission, "Submission saved.", 201);
}

async function review(req, res) {
  const submission = await submissionService.reviewSubmission(
    requestContext(req),
    req.validated.params.id,
    req.body,
  );
  return ok(res, submission, `Submission ${submission.reviewStatus.toLowerCase()}.`);
}

module.exports = {
  getAll, getById, create, review,
};
