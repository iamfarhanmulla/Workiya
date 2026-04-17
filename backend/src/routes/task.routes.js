const express = require("express");
const router  = express.Router();
const { getAll, getById, create, update, updateStatus, remove } = require("../controllers/task.controller");

router.get("/",             getAll);
router.get("/:id",          getById);
router.post("/",            create);
router.put("/:id",          update);
router.patch("/:id/status", updateStatus);
router.delete("/:id",       remove);

module.exports = router;
