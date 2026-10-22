const express = require("express");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const { ROLES } = require("../constants/roles");
const submissionController = require("../controllers/submission.controller");
const { idParams } = require("../validators/activity.schemas");
const {
  listSubmissionsQuery, reviewSubmissionBody,
} = require("../validators/submission.schemas");

const router = express.Router();
const staff = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER);
const withId = validate(idParams, "params");

router.get("/", validate(listSubmissionsQuery, "query"), submissionController.getAll);
router.get("/:id", withId, submissionController.getById);
router.patch(
  "/:id/review",
  staff,
  withId,
  validate(reviewSubmissionBody),
  submissionController.review,
);

module.exports = router;
