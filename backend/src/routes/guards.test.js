const crypto = require("node:crypto");
const request = require("supertest");

const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({
  sql: jest.requireActual("mssql"),
  connectDb: mockConnectDb,
  getPool: mockConnectDb,
}));

// eslint-disable-next-line n/no-sync -- one-time test key generation at load time
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
process.env.JWT_PRIVATE_KEY = Buffer.from(privateKey).toString("base64");
process.env.JWT_PUBLIC_KEY = Buffer.from(publicKey).toString("base64");

const app = require("../app");
const { signAccessToken } = require("../services/token.service");
const { ROLES } = require("../constants/roles");

const USERS = {
  admin: {
    id: 10, companyId: 2, roleId: 2, roleCode: ROLES.ADMIN,
  },
  manager: {
    id: 20, companyId: 2, roleId: 4, roleCode: ROLES.MANAGER,
  },
  employee: {
    id: 30, companyId: 2, roleId: 3, roleCode: ROLES.EMPLOYEE,
  },
};

function authCookie(user) {
  return `wk_at=${signAccessToken(user)}`;
}

// Fake mssql pool: answers queries in order and records every .input() call.
function mockPool(responses) {
  const queue = [...responses];
  const inputs = [];
  const queries = [];
  const pool = {
    request() {
      const req = {
        input(name, _type, value) {
          inputs.push({ name, value });
          return req;
        },
        async query(text) {
          queries.push(text);
          return queue.shift() || { recordset: [], rowsAffected: [0] };
        },
      };
      return req;
    },
  };
  mockConnectDb.mockResolvedValue(pool);
  return { inputs, queries };
}

describe("resource route guards", () => {
  beforeEach(() => {
    mockConnectDb.mockReset();
  });

  it("returns 403 when an EMPLOYEE creates a company", async () => {
    // Arrange
    const db = mockPool([]);

    // Act
    const res = await request(app)
      .post("/api/v1/companies")
      .set("Cookie", authCookie(USERS.employee))
      .set("X-Requested-With", "XMLHttpRequest")
      .send({ name: "Acme" });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
    expect(db.queries).toHaveLength(0);
  });

  it("returns 403 when a MANAGER deletes an employee", async () => {
    // Arrange
    const db = mockPool([]);

    // Act
    const res = await request(app)
      .delete("/api/v1/employees/5")
      .set("Cookie", authCookie(USERS.manager))
      .set("X-Requested-With", "XMLHttpRequest");

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
    expect(db.queries).toHaveLength(0);
  });

  it("returns 403 when an ADMIN creates a SUPER_ADMIN user", async () => {
    // Arrange
    const db = mockPool([{ recordset: [{ Code: ROLES.SUPER_ADMIN }], rowsAffected: [1] }]);

    // Act
    const res = await request(app)
      .post("/api/v1/users")
      .set("Cookie", authCookie(USERS.admin))
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        email: "new@example.com", password: "Str0ng!Passw0rd", roleId: 1, companyId: 2,
      });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false, message: "You are not allowed to assign this role or company.",
    });
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0]).not.toMatch(/INSERT/i);
  });

  it("uses the signed-in user as AssignedBy and CompanyId when creating a task", async () => {
    // Arrange
    const db = mockPool([
      { recordset: [{ DoctorOk: 1, AssigneeOk: 1 }], rowsAffected: [1] },
      { recordset: [{ Id: 77 }], rowsAffected: [1] },
    ]);

    // Act
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Cookie", authCookie(USERS.manager))
      .set("X-Requested-With", "XMLHttpRequest")
      .send({
        title: "Visit", doctorId: 3, assignedTo: 30, assignedBy: 999, companyId: 999,
      });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(77);
    expect(db.inputs).toContainEqual({ name: "assignedBy", value: USERS.manager.id });
    expect(db.inputs).not.toContainEqual({ name: "assignedBy", value: 999 });
    expect(db.inputs).toContainEqual({ name: "companyId", value: USERS.manager.companyId });
  });
});
