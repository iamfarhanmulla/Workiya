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

// Where each router lives under /api/v1. index.js mounts these and the API docs read them,
// so a new router added here is documented automatically. `tag` groups it in the docs.
const PUBLIC_MOUNTS = Object.freeze([
  { prefix: "/auth", router: authRoutes, tag: "Auth" },
  // Cron jobs authenticate with the CRON_SECRET bearer token, not a login cookie.
  { prefix: "/jobs", router: jobRouter, tag: "Jobs" },
]);

// Mounted after `authenticate`: every route here needs a signed-in user.
const PRIVATE_MOUNTS = Object.freeze([
  { prefix: "/companies", router: companyRoutes, tag: "Companies" },
  { prefix: "/users", router: userRoutes, tag: "Users" },
  { prefix: "/managers", router: managerRoutes, tag: "Managers" },
  { prefix: "/employees", router: employeeRoutes, tag: "Employees" },
  { prefix: "/settings", router: settingsRoutes, tag: "Settings" },
  { prefix: "/accounts", router: accountRoutes, tag: "Accounts" },
  { prefix: "/activities", router: activityRoutes, tag: "Activities" },
  { prefix: "/submissions", router: submissionRoutes, tag: "Submissions" },
  { prefix: "/visit-plans", router: visitPlanRouter, tag: "Visit plans" },
  { prefix: "/reports", router: reportRouter, tag: "Reports" },
]);

module.exports = { PUBLIC_MOUNTS, PRIVATE_MOUNTS };
