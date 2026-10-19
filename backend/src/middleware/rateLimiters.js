const crypto = require("node:crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { ERROR_CODES } = require("../constants/errorCodes");
const { COOKIE_NAMES } = require("../utils/authCookies");
const { fail } = require("../utils/apiResponse");

const WINDOW_MS = 15 * 60 * 1000;

function rateLimitedHandler(_req, res) {
  return fail(res, 429, ERROR_CODES.RATE_LIMITED, "Too many requests. Please try again later.");
}

function ipKey(req) {
  return ipKeyGenerator(req.ip || "");
}

function loginKey(req) {
  const email = req.body && typeof req.body.email === "string"
    ? req.body.email.trim().toLowerCase()
    : "";
  return `${ipKey(req)}|${email}`;
}

function readRefreshCookie(req) {
  return req.cookies ? req.cookies[COOKIE_NAMES.REFRESH] : undefined;
}

// Keyed by the refresh token itself, so users behind one office NAT do not share a budget.
function refreshKey(req) {
  return crypto.createHash("sha256").update(readRefreshCookie(req)).digest("hex");
}

// A refresh without a cookie is rejected before any DB work, so it does not spend a budget.
function hasNoRefreshCookie(req) {
  return !readRefreshCookie(req);
}

function limiter(limit, extra) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitedHandler,
    ...extra,
  });
}

// Ceiling per IP across all emails, against password spraying.
function createLoginIpLimiter() {
  return limiter(100, { keyGenerator: ipKey });
}

// Tighter ceiling per IP and email, against targeted guessing.
function createLoginLimiter() {
  return limiter(10, { keyGenerator: loginKey });
}

function createRefreshLimiter() {
  return limiter(30, { keyGenerator: refreshKey, skip: hasNoRefreshCookie });
}

function createRefreshIpLimiter() {
  return limiter(600, { keyGenerator: ipKey, skip: hasNoRefreshCookie });
}

module.exports = {
  loginIpLimiter: createLoginIpLimiter(),
  loginLimiter: createLoginLimiter(),
  refreshIpLimiter: createRefreshIpLimiter(),
  refreshLimiter: createRefreshLimiter(),
  createLoginIpLimiter,
  createLoginLimiter,
  createRefreshIpLimiter,
  createRefreshLimiter,
  loginKey,
};
