const express = require("express");

const router = express.Router();
const { authorize } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");
const {
  getAll, getById, create, update, toggleStatus, remove,
} = require("../controllers/company.controller");

router.use(authorize(ROLES.SUPER_ADMIN));

router.get("/", getAll);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.patch("/:id/status", toggleStatus);
router.delete("/:id", remove);

module.exports = router;
