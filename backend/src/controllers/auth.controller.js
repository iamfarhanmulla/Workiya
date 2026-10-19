const authService = require("../services/auth.service");
const { ok } = require("../utils/apiResponse");
const { COOKIE_NAMES, setAuthCookies, clearAuthCookies } = require("../utils/authCookies");

function requestContext(req) {
  return {
    ip: req.ip,
    userAgent: (req.get("user-agent") || "").slice(0, 500)
  };
}

function readRefreshCookie(req) {
  return req.cookies ? req.cookies[COOKIE_NAMES.REFRESH] : undefined;
}

async function login(req, res) {
  const { email, password, rememberMe } = req.body;
  const session = await authService.login({ email, password, rememberMe, ...requestContext(req) });
  setAuthCookies(res, session);
  return ok(res, { user: session.user }, "Login successful.");
}

async function refresh(req, res) {
  try {
    const session = await authService.refresh({ refreshToken: readRefreshCookie(req), ...requestContext(req) });
    // A concurrent rotation already sent this browser new cookies; keep them.
    if (!session.rotatedConcurrently) {
      setAuthCookies(res, session);
    }
    return ok(res, { user: session.user }, "Session refreshed.");
  } catch (err) {
    // Only a rejected session ends it; a transient failure (e.g. DB down) keeps the cookies for a retry.
    if (err.status === 401) {
      clearAuthCookies(res);
    }
    throw err;
  }
}

async function logout(req, res) {
  try {
    await authService.logout({ refreshToken: readRefreshCookie(req), ...requestContext(req) });
  } finally {
    clearAuthCookies(res);
  }
  return ok(res, null, "Logged out.");
}

async function me(req, res) {
  const user = await authService.me(req.user.id);
  return ok(res, { user });
}

module.exports = { login, refresh, logout, me };
