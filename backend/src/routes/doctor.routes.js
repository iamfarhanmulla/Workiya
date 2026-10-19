const express = require("express");
const router  = express.Router();
const { authorize } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");
const {
  getAll, getById, create, update, toggleStatus, remove,
} = require("../controllers/doctor.controller");

const staff = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER);

router.get("/",             getAll);
router.get("/:id",          getById);
router.post("/",            staff, create);
router.put("/:id",          staff, update);
router.patch("/:id/status", staff, toggleStatus);
router.delete("/:id",       staff, remove);

module.exports = router;
