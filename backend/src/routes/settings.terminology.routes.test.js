const { Router: mockRouter } = require("express");
const request = require("supertest");

const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({
  sql: jest.requireActual("mssql"),
  connectDb: mockConnectDb,
}));
jest.mock("../services/audit.service", () => ({ log: jest.fn() }));
// Routers owned by other modules: stubbed so these tests only exercise /settings.
jest.mock("./account.routes", () => mockRouter(), { virtual: true });
jest.mock("./activity.routes", () => mockRouter(), { virtual: true });
jest.mock("./submission.routes", () => mockRouter(), { virtual: true });

const app = require("../app");
const auditService = require("../services/audit.service");
const { XHR, USERS, authCookie } = require("../../test/helpers/apiHarness");
const { mockTransactionalPool, allInputs } = require("../../test/helpers/transactionPool");

const URL = "/api/v1/settings/terminology";

function send(method, url, user, body) {
  const req = request(app)[method](url).set("Cookie", authCookie(user)).set(XHR);
  return body === undefined ? req : req.send(body);
}

describe("settings routes: terminology", () => {
  beforeEach(() => {
    mockConnectDb.mockReset();
  });

  it("lets an EMPLOYEE read their company's labels with defaults", async () => {
    // Arrange
    const db = await mockTransactionalPool(mockConnectDb, [
      { recordset: [{ TermKey: "account.plural", Label: "Doctors" }] },
    ]);

    // Act
    const res = await send("get", URL, USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data["account.plural"]).toBe("Doctors");
    expect(res.body.data["account.singular"]).toBe("Account");
    expect(db.queries[0].inputs.companyId).toBe(2);
  });

  it("returns 403 when an EMPLOYEE updates labels", async () => {
    // Arrange
    const db = await mockTransactionalPool(mockConnectDb);

    // Act
    const res = await send("put", URL, USERS.employee, { labels: { "account.plural": "Doctors" } });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
    expect(db.queries).toHaveLength(0);
  });

  it("returns 403 when an ADMIN of company 2 asks for company 3", async () => {
    // Arrange
    const db = await mockTransactionalPool(mockConnectDb);

    // Act
    const read = await send("get", `${URL}?companyId=3`, USERS.admin);
    const write = await send("put", URL, USERS.admin, {
      companyId: 3, labels: { "account.plural": "Doctors" },
    });

    // Assert
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(write.body.errorCode).toBe("FORBIDDEN");
    expect(db.queries).toHaveLength(0);
  });

  it("returns 400 COMPANY_REQUIRED when SUPER_ADMIN omits companyId", async () => {
    // Arrange
    await mockTransactionalPool(mockConnectDb);

    // Act
    const res = await send("get", URL, USERS.superAdmin);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("COMPANY_REQUIRED");
  });

  it.each([
    [{ labels: { "account.plural": "Doctors", "doctor.plural": "x" } }],
    [{ labels: {} }],
    [{ labels: { "account.plural": "x".repeat(101) } }],
    [{}],
  ])("rejects an invalid body %p", async (body) => {
    // Arrange
    const db = await mockTransactionalPool(mockConnectDb);

    // Act
    const res = await send("put", URL, USERS.admin, body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
    expect(db.queries).toHaveLength(0);
  });

  it("saves labels for SUPER_ADMIN's chosen company in one transaction", async () => {
    // Arrange
    const db = await mockTransactionalPool(mockConnectDb, [
      { recordset: [] }, { rowsAffected: [1] }, { rowsAffected: [1] },
    ]);

    // Act
    const res = await send("put", URL, USERS.superAdmin, {
      companyId: 3, labels: { "account.singular": "Doctor", "account.plural": " Doctors " },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data["account.plural"]).toBe("Doctors");
    expect(db.tx).toEqual(["begin", "commit"]);
    expect(allInputs(db.queries)).toContainEqual({ name: "companyId", value: 3 });
    expect(allInputs(db.queries)).toContainEqual({ name: "userId", value: USERS.superAdmin.id });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "TERMINOLOGY_UPDATED", companyId: 3, performedBy: 1,
    }));
  });

  it("rolls back when a label fails to save", async () => {
    // Arrange
    const responses = [{ recordset: [] }, new Error("db down")];
    const db = await mockTransactionalPool(mockConnectDb, responses);

    // Act
    const res = await send("put", URL, USERS.admin, { labels: { "account.plural": "Doctors" } });

    // Assert
    expect(res.status).toBe(500);
    expect(db.tx).toEqual(["begin", "rollback"]);
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
