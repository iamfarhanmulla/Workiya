const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const { ok } = require("../utils/apiResponse");

const authRoutes = require("./auth.routes");
const companyRoutes = require("./company.routes");
const userRoutes = require("./user.routes");
const managerRoutes = require("./manager.routes");
const employeeRoutes = require("./employee.routes");
const settingsRoutes = require("./settings.routes");
const accountRoutes = require("./account.routes");
const activityRoutes = require("./activity.routes");
const submissionRoutes = require("./submission.routes");
const { visitPlanRouter, reportRouter, jobRouter } = require("./visitPlan.routes");

const router = express.Router();

router.get("/health", (_req, res) => ok(res, { status: "ok" }, "Backend is running."));
router.use("/auth", authRoutes);
// Cron jobs authenticate with the CRON_SECRET bearer token, not a login cookie.
router.use("/jobs", jobRouter);

router.use(authenticate);

router.use("/companies", companyRoutes);
router.use("/users", userRoutes);
router.use("/managers", managerRoutes);
router.use("/employees", employeeRoutes);
router.use("/settings", settingsRoutes);
router.use("/accounts", accountRoutes);
router.use("/activities", activityRoutes);
router.use("/submissions", submissionRoutes);
router.use("/visit-plans", visitPlanRouter);
router.use("/reports", reportRouter);

module.exports = router;
