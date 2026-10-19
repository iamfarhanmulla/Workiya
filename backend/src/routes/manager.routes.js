const express = require("express");
const router  = express.Router();
const { authorize } = require("../middleware/authorize");
const { ROLES } = require("../constants/roles");
const { getAll, getById, create, update, remove, toggleStatus } = require("../controllers/manager.controller");

router.use(authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN));

router.get("/",              getAll);
router.get("/:id",           getById);
router.post("/",             create);
router.put("/:id",           update);
router.patch("/:id/status",  toggleStatus);
router.delete("/:id",        remove);

module.exports = router;
