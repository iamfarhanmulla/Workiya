const express = require("express");
const { authorize } = require("../middleware/authorize");
const { validate } = require("../middleware/validate");
const { ROLES } = require("../constants/roles");
const controller = require("../controllers/visitPlan.controller");
const {
  planBody, markMissedBody, coverageQuery, trendQuery,
} = require("../validators/visitPlan.schemas");

const staff = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER);
const admins = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN);

// Mounted at /visit-plans
const visitPlanRouter = express.Router();
visitPlanRouter.post("/preview", staff, validate(planBody), controller.preview);
visitPlanRouter.post("/mark-missed", admins, validate(markMissedBody), controller.markMissed);
visitPlanRouter.post("/", staff, validate(planBody), controller.generate);

// Mounted at /reports. Any signed-in role; the service limits EMPLOYEE to their own numbers.
const reportRouter = express.Router();
reportRouter.get("/coverage", validate(coverageQuery, "query"), controller.coverage);
reportRouter.get("/trend", validate(trendQuery, "query"), controller.trend);

// Mounted at /jobs BEFORE authenticate: Vercel Cron calls it with the CRON_SECRET bearer token.
const jobRouter = express.Router();
jobRouter.get("/missed-visits", controller.cronMissedVisits);

module.exports = { visitPlanRouter, reportRouter, jobRouter };
