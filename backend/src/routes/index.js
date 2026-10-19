const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const { ok } = require("../utils/apiResponse");

const authRoutes = require("./auth.routes");
const companyRoutes = require("./company.routes");
const userRoutes = require("./user.routes");
const managerRoutes = require("./manager.routes");
const employeeRoutes = require("./employee.routes");
const doctorRoutes = require("./doctor.routes");
const taskRoutes = require("./task.routes");

const router = express.Router();

router.get("/health", (_req, res) => ok(res, { status: "ok" }, "Backend is running."));
router.use("/auth", authRoutes);

router.use(authenticate);

router.use("/companies", companyRoutes);
router.use("/users", userRoutes);
router.use("/managers", managerRoutes);
router.use("/employees", employeeRoutes);
router.use("/doctors", doctorRoutes);
router.use("/tasks", taskRoutes);

module.exports = router;
