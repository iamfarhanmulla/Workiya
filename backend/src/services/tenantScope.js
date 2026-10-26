const { ROLES } = require("../constants/roles");

const MATCH_ALL = "TRUE";

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

// The helpers below return a SQL predicate built only from code-defined text and add the
// values it references to `params` (named "@" parameters for config/db.query).

// Limits rows to the caller's company. A caller without a company binds NULL: matches nothing.
function companyFilter(user, column, params) {
  if (isSuperAdmin(user)) {
    return MATCH_ALL;
  }
  Object.assign(params, { scopeCompanyId: toId(user.companyId) });
  return `${column} = @scopeCompanyId`;
}

// users rows the caller may read or change: their own company, and never a SUPER_ADMIN.
function manageableUserFilter(user, params, prefix = "") {
  if (isSuperAdmin(user)) {
    return MATCH_ALL;
  }
  Object.assign(params, {
    scopeCompanyId: toId(user.companyId),
    superAdminCode: ROLES.SUPER_ADMIN,
  });
  return `${prefix}company_id = @scopeCompanyId`
    + ` AND ${prefix}role_id NOT IN (SELECT id FROM roles WHERE code = @superAdminCode)`;
}

// users rows holding one role, looked up by roles.code rather than a hard-coded id.
function roleFilter(roleCode, params, prefix = "") {
  Object.assign(params, { roleCode });
  return `${prefix}role_id IN (SELECT id FROM roles WHERE code = @roleCode)`;
}

module.exports = {
  toId, isSuperAdmin, resolveCompanyId, companyFilter, manageableUserFilter, roleFilter,
};
