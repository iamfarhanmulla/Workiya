const { signAccessToken } = require("../../src/services/token.service");
const { ROLES } = require("../../src/constants/roles");

const XHR = Object.freeze({ "X-Requested-With": "XMLHttpRequest" });

// Role ids follow the legacy Roles table (EMPLOYEE = 3, MANAGER = 4); code reads only roleCode.
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

// Fake mssql pool. Answers queries in order (an Error entry rejects) and records, per query,
// the SQL text and the inputs bound on that request.
function mockPool(connectDb, responses = []) {
  const queue = [...responses];
  const queries = [];
  const pool = {
    request() {
      const inputs = {};
      const req = {
        input(name, _type, value) {
          inputs[name] = value;
          return req;
        },
        async query(text) {
          queries.push({ text, inputs });
          const next = queue.shift() || { recordset: [], rowsAffected: [0] };
          if (next instanceof Error) {
            throw next;
          }
          return next;
        },
      };
      return req;
    },
  };
  connectDb.mockResolvedValue(pool);
  return { queries };
}

function rows(...recordset) {
  return { recordset, rowsAffected: [recordset.length] };
}

function affected(count) {
  return { recordset: [], rowsAffected: [count] };
}

module.exports = {
  XHR, USERS, authCookie, mockPool, rows, affected,
};
