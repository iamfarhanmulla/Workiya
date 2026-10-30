const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const { ok } = require("../utils/apiResponse");
const { PUBLIC_MOUNTS, PRIVATE_MOUNTS } = require("./mounts");
const docsRoutes = require("./docs.routes");

const router = express.Router();

router.get("/health", (_req, res) => ok(res, { status: "ok" }, "Backend is running."));
// API docs: open locally, SUPER_ADMIN only in production (docs.routes decides).
router.use("/docs", docsRoutes);
PUBLIC_MOUNTS.forEach(({ prefix, router: mounted }) => router.use(prefix, mounted));

router.use(authenticate);

PRIVATE_MOUNTS.forEach(({ prefix, router: mounted }) => router.use(prefix, mounted));

module.exports = router;
