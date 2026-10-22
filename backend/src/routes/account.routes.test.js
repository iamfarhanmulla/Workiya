const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));
jest.mock("../services/audit.service");
jest.mock("../services/customFields.service");

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const accountRoutes = require("./account.routes");
const { authenticate } = require("../middleware/authenticate");
const { errorHandler } = require("../middleware/errorHandler");
const customFieldsService = require("../services/customFields.service");
const {
  USERS, authCookie, mockPool, rows, affected,
} = require("../../test/helpers/apiHarness");

// The accounts router behind the real authentication and error handler.
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/accounts", authenticate, accountRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

function call(method, url, user) {
  const req = request(app)[method](`/api/v1/accounts${url}`);
  return user ? req.set("Cookie", authCookie(user)) : req;
}

function withTransactions(db) {
  return mockConnectDb().then((pool) => {
    Object.assign(pool, {
      transaction: () => ({
        begin: jest.fn().mockResolvedValue(),
        commit: jest.fn().mockResolvedValue(),
        rollback: jest.fn().mockResolvedValue(),
        request: () => pool.request(),
      }),
    });
    return db;
  });
}

beforeEach(() => {
  mockConnectDb.mockReset();
  customFieldsService.validateValues.mockResolvedValue({ ok: true, value: {} });
});

describe("account routes permissions", () => {
  it("requires a login", async () => {
    // Arrange / Act
    const res = await call("get", "/");

    // Assert
    expect(res.status).toBe(401);
  });

  it.each([
    ["post", "/", { name: "A" }],
    ["put", "/4", { name: "A" }],
    ["patch", "/4/status", { isActive: false }],
    ["delete", "/4", undefined],
    ["get", "/4/assignments", undefined],
    ["put", "/4/assignments", { assignments: [] }],
    ["post", "/assignments/transfer", { fromUserId: 1, toUserId: 2 }],
  ])("forbids an EMPLOYEE to %s %s", async (method, url, body) => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call(method, url, USERS.employee).send(body);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, errorCode: "FORBIDDEN" });
    expect(db.queries).toHaveLength(0);
  });

  it("returns 404 to an EMPLOYEE for an account not assigned to them", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    const res = await call("get", "/4", USERS.employee);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, errorCode: "NOT_FOUND" });
    expect(db.queries[0].text).toContain("aa.UserId = @me");
    expect(db.queries[0].inputs).toMatchObject({ id: 4, me: 30, scopeCompanyId: 2 });
  });

  it("lists an EMPLOYEE's assigned accounts in the standard wrapper", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [
      { recordsets: [[{ Total: 1 }], [{ Id: 4, CompanyId: 2, Name: "A" }]] },
      rows({ AccountId: 4, UserId: 30, DisplayName: "Rep" }),
    ]);

    // Act
    const res = await call("get", "/?page=1&pageSize=10", USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total: 1, page: 1, pageSize: 10, items: [{ id: 4, assignedUsers: [{ userId: 30 }] }],
    });
    expect(db.queries[0].text).toContain("aa.UserId = @me");
  });
});

describe("account routes validation and writes", () => {
  it.each([
    ["get", "/abc", undefined],
    ["get", "/?pageSize=500", undefined],
    ["post", "/", { name: "" }],
    ["post", "/", { name: "A", latitude: 91 }],
    ["put", "/4/assignments", { assignments: [{ userId: 3 }, { userId: 3 }] }],
    ["post", "/assignments/transfer", { fromUserId: 3, toUserId: 3 }],
  ])("rejects %s %s with VALIDATION_FAILED", async (method, url, body) => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call(method, url, USERS.manager).send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
  });

  it("creates an account for a MANAGER and returns 201", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 9 }), rows({ Id: 9, CompanyId: 2, Name: "A" })]);

    // Act
    const res = await call("post", "/", USERS.manager).send({ name: " A ", latitude: "12.5" });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 9, name: "A" });
    expect(db.queries[0].inputs).toMatchObject({ companyId: 2, name: "A", latitude: 12.5 });
  });

  it.each([
    ["put", "/4", { name: "B" }, "Account updated."],
    ["patch", "/4/status", { isActive: false }, "Account deactivated."],
    ["patch", "/4/status", { isActive: true }, "Account activated."],
  ])("%s %s succeeds for staff", async (method, url, body, message) => {
    // Arrange
    const row = rows({ Id: 4, CompanyId: 2, Name: "B" });
    mockPool(mockConnectDb, [row, { recordset: [], rowsAffected: [1] }, row]);

    // Act
    const res = await call(method, url, USERS.admin).send(body);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(message);
  });

  it("soft-deletes an account inside a transaction", async () => {
    // Arrange
    const db = await withTransactions(mockPool(mockConnectDb, [rows({ Id: 4, CompanyId: 2 })]));

    // Act
    const res = await call("delete", "/4", USERS.manager);

    // Assert
    expect(res.status).toBe(200);
    expect(db.queries.map((q) => q.text).join()).toContain("UPDATE AccountAssignments");
  });

  it("lists an account's assignments for staff", async () => {
    // Arrange
    mockPool(mockConnectDb, [
      rows({ Id: 4, CompanyId: 2 }),
      rows({
        AccountId: 4, UserId: 30, DisplayName: "Rep", RoleCode: "EMPLOYEE",
      }),
    ]);

    // Act
    const res = await call("get", "/4/assignments", USERS.manager);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{
      userId: 30, displayName: "Rep", roleCode: "EMPLOYEE", visitsPerMonth: null,
    }]);
  });

  it("replaces an account's assignments in a transaction", async () => {
    // Arrange
    const db = await withTransactions(mockPool(mockConnectDb, [
      rows({ Id: 4, CompanyId: 2 }),
      rows({ Id: 30 }),
      rows(),
      affected(1),
      rows({ AccountId: 4, UserId: 30, DisplayName: "Rep" }),
    ]));

    // Act
    const res = await call("put", "/4/assignments", USERS.manager)
      .send({ assignments: [{ userId: 30, visitsPerMonth: 4 }] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Assignments saved.");
    expect(db.queries[3].text).toContain("INSERT INTO AccountAssignments");
    expect(db.queries[3].inputs).toMatchObject({ account0: 4, user0: 30, visits0: 4 });
  });

  it("transfers a rep's accounts and reports how many moved", async () => {
    // Arrange
    await withTransactions(mockPool(mockConnectDb, [
      rows({ Id: 30 }),
      rows({ Id: 31 }),
      rows({ Id: 1, AccountId: 4, VisitsPerMonth: 2 }),
      rows(),
    ]));

    // Act
    const res = await call("post", "/assignments/transfer", USERS.manager)
      .send({ fromUserId: 30, toUserId: 31 });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: { moved: 1 }, message: "1 account(s) transferred." });
  });

  it("rejects a transfer to a user of another company", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 30 }), rows()]);

    // Act
    const res = await call("post", "/assignments/transfer", USERS.manager)
      .send({ fromUserId: 30, toUserId: 99 });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("CROSS_COMPANY_REFERENCE");
  });
});
