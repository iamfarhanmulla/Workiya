const activityService = require("../services/activity.service");
const { ok } = require("../utils/apiResponse");

// The signed-in user plus the request details every audit entry records.
function requestContext(req) {
  return {
    user: req.user,
    ip: req.ip,
    userAgent: (req.get("user-agent") || "").slice(0, 500),
  };
}

async function getAll(req, res) {
  const page = await activityService.listActivities(req.user, req.validated.query);
  return ok(res, page);
}

async function getById(req, res) {
  const activity = await activityService.getActivity(req.user, req.validated.params.id);
  return ok(res, activity);
}

async function create(req, res) {
  const activity = await activityService.createActivity(requestContext(req), req.body);
  return ok(res, activity, "Activity created.", 201);
}

async function update(req, res) {
  const activity = await activityService.updateActivity(
    requestContext(req),
    req.validated.params.id,
    req.body,
  );
  return ok(res, activity, "Activity updated.");
}

async function updateStatus(req, res) {
  const activity = await activityService.changeActivityStatus(
    requestContext(req),
    req.validated.params.id,
    req.body.status,
  );
  return ok(res, activity, `Activity moved to ${activity.status}.`);
}

async function remove(req, res) {
  await activityService.deleteActivity(requestContext(req), req.validated.params.id);
  return ok(res, null, "Activity deleted.");
}

module.exports = {
  requestContext, getAll, getById, create, update, updateStatus, remove,
};
