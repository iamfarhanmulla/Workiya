const { signAccessToken } = require("../../src/services/token.service");
const { ROLES } = require("../../src/constants/roles");
const { rows, affected } = require("./mockDb");

const XHR = Object.freeze({ "X-Requested-With": "XMLHttpRequest" });

// Role ids follow the roles table (EMPLOYEE = 3, MANAGER = 4); code reads only roleCode.
const USERS = Object.freeze({
  superAdmin: {
    id: 1, companyId: null, roleId: 1, roleCode: ROLES.SUPER_ADMIN,
  },
  admin: {
    id: 10, companyId: 2, roleId: 2, roleCode: ROLES.ADMIN,
  },
  manager: {
    id: 20, companyId: 2, roleId: 4, roleCode: ROLES.MANAGER,
  },
  employee: {
    id: 30, companyId: 2, roleId: 3, roleCode: ROLES.EMPLOYEE,
  },
});

function authCookie(user) {
  return `wk_at=${signAccessToken(user)}`;
}

// Database fakes live in ./mockDb (mockDb, rows, affected, allParams); rows and affected are
// re-exported here for route tests that build pg-style results.
module.exports = {
  XHR, USERS, authCookie, rows, affected,
};
