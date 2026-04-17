const express = require("express");
const router  = express.Router();
const { getAll, getById, create, update, toggleStatus, remove, getManagersList } = require("../controllers/employee.controller");

router.get("/managers-list",  getManagersList);
router.get("/",               getAll);
router.get("/:id",            getById);
router.post("/",              create);
router.put("/:id",            update);
router.patch("/:id/status",   toggleStatus);
router.delete("/:id",         remove);

module.exports = router;
