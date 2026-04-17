const express = require("express");
const router  = express.Router();
const { getAll, getById, create, update, toggleStatus, remove } = require("../controllers/company.controller");

router.get("/",               getAll);
router.get("/:id",            getById);
router.post("/",              create);
router.put("/:id",            update);
router.patch("/:id/status",   toggleStatus);
router.delete("/:id",         remove);

module.exports = router;
