const express = require("express");

const { login } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", login);
router.post("/logout", (_req, res) => res.json({ success: true, message: "Logged out." }));

module.exports = router;
