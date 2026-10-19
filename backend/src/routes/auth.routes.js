const express = require("express");
const { z } = require("zod");
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/authenticate");
const { validate } = require("../middleware/validate");
const {
  loginIpLimiter, loginLimiter, refreshIpLimiter, refreshLimiter,
} = require("../middleware/rateLimiters");

const loginSchema = z.object({
  email: z.string().trim().max(320).pipe(z.email()),
  password: z.string().min(1).max(256),
  rememberMe: z.boolean().optional(),
});

const router = express.Router();

router.post("/login", loginIpLimiter, loginLimiter, validate(loginSchema), authController.login);
router.post("/refresh", refreshIpLimiter, refreshLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", authenticate, authController.me);

module.exports = router;
