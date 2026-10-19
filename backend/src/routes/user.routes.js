const express = require("express");

const router = express.Router();
const { authorize } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");
const {
  getAll, getById, create, update, remove, getRoles, getCompanies,
} = require("../controllers/user.controller");

router.use(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get("/roles", getRoles);
router.get("/companies", getCompanies);
router.get("/", getAll);
router.get("/:id", getById);
router.post("/", create);
router.put("/:id", update);
router.delete("/:id", remove);

module.exports = router;
