jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());
jest.mock("../services/audit.service");
jest.mock("../services/customFields.service");

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const db = require("../config/db");
const accountRoutes = require("./account.routes");
const { authenticate } = require("../middleware/authenticate");
const { errorHandler } = require("../middleware/errorHandler");
const customFieldsService = require("../services/customFields.service");
const {
  USERS, authCookie, rows, affected,
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

beforeEach(() => {
  db.reset();
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
    db.reset();

    // Act
    const res = await call(method, url, USERS.employee).send(body);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, errorCode: "FORBIDDEN" });
    expect(db.calls).toHaveLength(0);
  });

  it("returns 404 to an EMPLOYEE for an account not assigned to them", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await call("get", "/4", USERS.employee);

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, errorCode: "NOT_FOUND" });
    expect(db.calls[0].text).toContain("aa.user_id = @me");
    expect(db.calls[0].params).toMatchObject({ id: 4, me: 30, scopeCompanyId: 2 });
  });

  it("lists an EMPLOYEE's assigned accounts in the standard wrapper", async () => {
    // Arrange
    db.reset([
      rows({ total: 1 }),
      rows({ id: 4, company_id: 2, name: "A" }),
      rows({ account_id: 4, user_id: 30, display_name: "Rep" }),
    ]);

    // Act
    const res = await call("get", "/?page=1&pageSize=10", USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total: 1, page: 1, pageSize: 10, items: [{ id: 4, assignedUsers: [{ userId: 30 }] }],
    });
    expect(db.calls[0].text).toContain("aa.user_id = @me");
    expect(db.calls[1].params).toMatchObject({ pageSize: 10, offset: 0 });
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
    db.reset();

    // Act
    const res = await call(method, url, USERS.manager).send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
  });

  it("creates an account for a MANAGER and returns 201", async () => {
    // Arrange
    db.reset([rows({ id: 9 }), rows({ id: 9, company_id: 2, name: "A" })]);

    // Act
    const res = await call("post", "/", USERS.manager).send({ name: " A ", latitude: "12.5" });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 9, name: "A" });
    expect(db.calls[0].params).toMatchObject({ companyId: 2, name: "A", latitude: 12.5 });
  });

  it.each([
    ["put", "/4", { name: "B" }, "Account updated."],
    ["patch", "/4/status", { isActive: false }, "Account deactivated."],
    ["patch", "/4/status", { isActive: true }, "Account activated."],
  ])("%s %s succeeds for staff", async (method, url, body, message) => {
    // Arrange
    const row = rows({ id: 4, company_id: 2, name: "B" });
    db.reset([row, affected(1), row]);

    // Act
    const res = await call(method, url, USERS.admin).send(body);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe(message);
  });

  it("soft-deletes an account inside a transaction", async () => {
    // Arrange
    db.reset([rows({ id: 4, company_id: 2 }), affected(1), affected(1)]);

    // Act
    const res = await call("delete", "/4", USERS.manager);

    // Assert
    expect(res.status).toBe(200);
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    expect(db.calls.map((q) => q.text).join()).toContain("UPDATE account_assignments");
  });

  it("lists an account's assignments for staff", async () => {
    // Arrange
    db.reset([
      rows({ id: 4, company_id: 2 }),
      rows({
        account_id: 4, user_id: 30, display_name: "Rep", role_code: "EMPLOYEE",
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
    db.reset([
      rows({ id: 4, company_id: 2 }),
      rows({ id: 30 }),
      rows({ id: 4 }),
      rows(),
      affected(1),
      rows({ account_id: 4, user_id: 30, display_name: "Rep" }),
    ]);

    // Act
    const res = await call("put", "/4/assignments", USERS.manager)
      .send({ assignments: [{ userId: 30, visitsPerMonth: 4 }] });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Assignments saved.");
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const insert = db.statements()[4];
    expect(insert.text).toContain("INSERT INTO account_assignments");
    expect(insert.params).toMatchObject({ accountIds: [4], userIds: [30], visits: [4] });
  });

  it("transfers a rep's accounts and reports how many moved", async () => {
    // Arrange
    db.reset([
      rows({ id: 30 }),
      rows({ id: 31 }),
      rows({ id: 1, account_id: 4, visits_per_month: 2 }),
      rows(),
      affected(1),
      affected(1),
    ]);

    // Act
    const res = await call("post", "/assignments/transfer", USERS.manager)
      .send({ fromUserId: 30, toUserId: 31 });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ data: { moved: 1 }, message: "1 account(s) transferred." });
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
  });

  it("rejects a transfer to a user of another company", async () => {
    // Arrange
    db.reset([rows({ id: 30 }), rows()]);

    // Act
    const res = await call("post", "/assignments/transfer", USERS.manager)
      .send({ fromUserId: 30, toUserId: 99 });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("CROSS_COMPANY_REFERENCE");
  });
});
