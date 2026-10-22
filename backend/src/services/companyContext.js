const AppError = require("../utils/AppError");
const { ERROR_CODES } = require("../constants/errorCodes");
const { toId, isSuperAdmin } = require("./tenantScope");

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

// The company a request acts on. Non-super-admins are pinned to their own company (asking for
// another one is refused). SUPER_ADMIN has no home company, so they must name one explicitly.
function requireCompanyId(user, requestedCompanyId) {
  const requested = toId(requestedCompanyId);
  if (isSuperAdmin(user)) {
    if (requested === null) {
      throw new AppError(400, ERROR_CODES.COMPANY_REQUIRED, "companyId is required.");
    }
    if (!isPositiveInt(requested)) {
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_FAILED,
        "companyId must be a positive integer.",
      );
    }
    return requested;
  }
  const own = toId(user && user.companyId);
  if (!isPositiveInt(own) || (requested !== null && requested !== own)) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "You are not allowed to access this company.");
  }
  return own;
}

module.exports = { requireCompanyId };
