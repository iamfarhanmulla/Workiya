const { Router: mockRouter } = require("express");
const request = require("supertest");

jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());
jest.mock("../services/audit.service", () => ({ log: jest.fn() }));
// Routers owned by other modules: stubbed so these tests only exercise /settings.
jest.mock("./account.routes", () => mockRouter(), { virtual: true });
jest.mock("./activity.routes", () => mockRouter(), { virtual: true });
jest.mock("./submission.routes", () => mockRouter(), { virtual: true });

const db = require("../config/db");
const app = require("../app");
const auditService = require("../services/audit.service");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

const URL = "/api/v1/settings/terminology";

function send(method, url, user, body) {
  const req = request(app)[method](url).set("Cookie", authCookie(user)).set(XHR);
  return body === undefined ? req : req.send(body);
}

describe("settings routes: terminology", () => {
  beforeEach(() => {
    db.reset();
    auditService.log.mockClear();
  });

  it("lets an EMPLOYEE read their company's labels with defaults", async () => {
    // Arrange
    db.reset([rows({ term_key: "account.plural", label: "Doctors" })]);

    // Act
    const res = await send("get", URL, USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data["account.plural"]).toBe("Doctors");
    expect(res.body.data["account.singular"]).toBe("Account");
    expect(db.calls[0].params.companyId).toBe(2);
  });

  it("returns 403 when an EMPLOYEE updates labels", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("put", URL, USERS.employee, { labels: { "account.plural": "Doctors" } });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when an ADMIN of company 2 asks for company 3", async () => {
    // Arrange
    db.reset();

    // Act
    const read = await send("get", `${URL}?companyId=3`, USERS.admin);
    const write = await send("put", URL, USERS.admin, {
      companyId: 3, labels: { "account.plural": "Doctors" },
    });

    // Assert
    expect(read.status).toBe(403);
    expect(write.status).toBe(403);
    expect(write.body.errorCode).toBe("FORBIDDEN");
    expect(db.calls).toHaveLength(0);
  });

  it("returns 400 COMPANY_REQUIRED when SUPER_ADMIN omits companyId", async () => {
    // Arrange
    db.reset();

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
    db.reset();

    // Act
    const res = await send("put", URL, USERS.admin, body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
    expect(db.calls).toHaveLength(0);
  });

  it("saves every label for SUPER_ADMIN's chosen company in one statement", async () => {
    // Arrange
    db.reset([rows(), affected(2)]);

    // Act
    const res = await send("put", URL, USERS.superAdmin, {
      companyId: 3, labels: { "account.singular": "Doctor", "account.plural": " Doctors " },
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data["account.plural"]).toBe("Doctors");
    expect(db.calls).toHaveLength(2);
    expect(db.calls[1].text).toContain("ON CONFLICT (company_id, term_key)");
    expect(db.calls[1].params).toEqual({
      companyId: 3,
      userId: USERS.superAdmin.id,
      termKeys: ["account.singular", "account.plural"],
      labels: ["Doctor", "Doctors"],
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "TERMINOLOGY_UPDATED", companyId: 3, performedBy: 1,
    }));
  });

  it("returns 500 and writes no audit entry when the labels fail to save", async () => {
    // Arrange
    db.reset([rows(), new Error("db down")]);

    // Act
    const res = await send("put", URL, USERS.admin, { labels: { "account.plural": "Doctors" } });

    // Assert
    expect(res.status).toBe(500);
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
