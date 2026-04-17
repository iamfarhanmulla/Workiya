const express = require("express");
const router  = express.Router();
const { getAll, getById, create, update, remove, toggleStatus } = require("../controllers/manager.controller");

router.get("/",              getAll);
router.get("/:id",           getById);
router.post("/",             create);
router.put("/:id",           update);
router.patch("/:id/status",  toggleStatus);
router.delete("/:id",        remove);

module.exports = router;
