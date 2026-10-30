const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

// The returned middleware carries the allowed roles so the API docs can list them.
function authorize(...roleCodes) {
  const allowed = new Set(roleCodes);
  function authorizeRole(req, res, next) {
    if (!req.user || !allowed.has(req.user.roleCode)) {
      return fail(
        res,
        403,
        ERROR_CODES.FORBIDDEN,
        "You do not have permission to perform this action.",
      );
    }
    return next();
  }
  authorizeRole.roles = roleCodes;
  return authorizeRole;
}

module.exports = { authorize };
