const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function csrfProtection(req, res, next) {
  if (UNSAFE_METHODS.has(req.method) && req.get("X-Requested-With") !== "XMLHttpRequest") {
    return fail(res, 403, ERROR_CODES.CSRF_HEADER_MISSING, "Missing X-Requested-With header.");
  }
  return next();
}

module.exports = { csrfProtection };
