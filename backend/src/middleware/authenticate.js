const { verifyAccessToken } = require("../services/token.service");
const { COOKIE_NAMES } = require("../utils/authCookies");
const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

function authenticate(req, res, next) {
  const token = req.cookies ? req.cookies[COOKIE_NAMES.ACCESS] : undefined;
  if (!token) {
    return fail(res, 401, ERROR_CODES.AUTH_REQUIRED, "Authentication required.");
  }

  try {
    const claims = verifyAccessToken(token);
    req.user = {
      id: Number(claims.sub),
      companyId: claims.cid,
      roleId: claims.rid,
      roleCode: claims.role,
    };
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return fail(res, 401, ERROR_CODES.AUTH_TOKEN_EXPIRED, "Session expired.");
    }
    return fail(res, 401, ERROR_CODES.AUTH_INVALID_TOKEN, "Invalid session.");
  }
}

module.exports = { authenticate };
