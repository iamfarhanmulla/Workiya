const express = require("express");

const router = express.Router();
const { authorize } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");
const {
  getAll, getById, create, update, toggleStatus, remove, getManagersList,
} = require("../controllers/employee.controller");

const staff = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER);
const admins = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN);

router.get("/managers-list", staff, getManagersList);
router.get("/", staff, getAll);
router.get("/:id", staff, getById);
router.post("/", staff, create);
router.put("/:id", staff, update);
router.patch("/:id/status", staff, toggleStatus);
router.delete("/:id", admins, remove);

module.exports = router;
