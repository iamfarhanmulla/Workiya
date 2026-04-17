const express = require("express");
const router = express.Router();
const { getAll, getById, create, update, remove, getRoles, getCompanies } = require("../controllers/user.controller");

router.get("/roles",     getRoles);
router.get("/companies", getCompanies);
router.get("/",      getAll);
router.get("/:id",   getById);
router.post("/",     create);
router.put("/:id",   update);
router.delete("/:id", remove);

module.exports = router;
