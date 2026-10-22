const express = require("express");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const { ROLES } = require("../constants/roles");
const activityController = require("../controllers/activity.controller");
const submissionController = require("../controllers/submission.controller");
const {
  idParams, listActivitiesQuery, createActivityBody, updateActivityBody, activityStatusBody,
} = require("../validators/activity.schemas");
const { createSubmissionBody } = require("../validators/submission.schemas");

const router = express.Router();
const staff = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER);
const withId = validate(idParams, "params");

router.get("/", validate(listActivitiesQuery, "query"), activityController.getAll);
router.get("/:id", withId, activityController.getById);
router.post("/", staff, validate(createActivityBody), activityController.create);
router.put("/:id", staff, withId, validate(updateActivityBody), activityController.update);
// Any signed-in user; the service limits EMPLOYEE to their own activities and transitions.
router.patch("/:id/status", withId, validate(activityStatusBody), activityController.updateStatus);
router.delete("/:id", staff, withId, activityController.remove);
// Only the activity's assignee may submit; the service enforces it.
router.post(
  "/:id/submissions",
  withId,
  validate(createSubmissionBody),
  submissionController.create,
);

module.exports = router;
