const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

function authorize(...roleCodes) {
  const allowed = new Set(roleCodes);
  return function authorizeRole(req, res, next) {
    if (!req.user || !allowed.has(req.user.roleCode)) {
      return fail(res, 403, ERROR_CODES.FORBIDDEN, "You do not have permission to perform this action.");
    }
    return next();
  };
}

module.exports = { authorize };
