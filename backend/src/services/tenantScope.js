const { sql } = require("../config/db");
const { ROLES } = require("../constants/roles");

const MATCH_ALL = "1 = 1";

function toId(value) {
  return value === undefined || value === null || value === "" ? null : Number(value);
}

function isSuperAdmin(user) {
  return Boolean(user) && user.roleCode === ROLES.SUPER_ADMIN;
}

// SUPER_ADMIN may choose any company, or none. Everyone else is pinned to their own company:
// an empty value defaults to it, and a different company is refused.
function resolveCompanyId(user, requestedCompanyId) {
  const requested = toId(requestedCompanyId);
  if (isSuperAdmin(user)) {
    return { allowed: true, companyId: requested };
  }
  const own = toId(user.companyId);
  if (requested !== null && requested !== own) {
    return { allowed: false, companyId: null };
  }
  return { allowed: true, companyId: own };
}

// SQL predicate limiting rows to the caller's company. A caller without a company matches nothing.
function companyFilter(request, user, column) {
  if (isSuperAdmin(user)) {
    return MATCH_ALL;
  }
  request.input("scopeCompanyId", sql.Int, toId(user.companyId));
  return `${column} = @scopeCompanyId`;
}

// dbo.Users rows the caller may read or change: their own company, and never a SUPER_ADMIN.
function manageableUserFilter(request, user, prefix = "") {
  if (isSuperAdmin(user)) {
    return MATCH_ALL;
  }
  request.input("scopeCompanyId", sql.Int, toId(user.companyId));
  request.input("superAdminCode", sql.NVarChar(50), ROLES.SUPER_ADMIN);
  return `${prefix}CompanyId = @scopeCompanyId`
    + ` AND ${prefix}RoleId NOT IN (SELECT Id FROM Roles WHERE Code = @superAdminCode)`;
}

// dbo.Users rows holding one role, looked up by Roles.Code rather than a hard-coded Id.
function roleFilter(request, roleCode, prefix = "") {
  request.input("roleCode", sql.NVarChar(50), roleCode);
  return `${prefix}RoleId IN (SELECT Id FROM Roles WHERE Code = @roleCode)`;
}

module.exports = { toId, isSuperAdmin, resolveCompanyId, companyFilter, manageableUserFilter, roleFilter };
