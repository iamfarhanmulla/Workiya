jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const request = require("supertest");
const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.superAdmin) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

function uniqueViolation() {
  return Object.assign(new Error("duplicate key"), { code: "23505" });
}

beforeEach(() => {
  db.reset();
});

describe("company.controller reads", () => {
  it("counts employees and managers by role code, not hard-coded role ids", async () => {
    // Arrange
    db.reset([rows({ Id: 2, TotalUsers: 3 })]);

    // Act
    const res = await call("get", "/companies");

    // Assert
    expect(res.body).toEqual({ success: true, data: [{ Id: 2, TotalUsers: 3 }] });
    expect(db.calls[0].text).toContain("code = @employeeCode");
    expect(db.calls[0].text).toContain("code = @managerCode");
    expect(db.calls[0].text).toContain("c.updated_at AS \"UpdatedAtUtc\"");
    expect(db.calls[0].params).toEqual({ employeeCode: "EMPLOYEE", managerCode: "MANAGER" });
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 2 })], 200],
  ])("reads one company", async (responses, status) => {
    // Arrange
    db.reset(responses);

    // Act
    const res = await call("get", "/companies/2");

    // Assert
    expect(res.status).toBe(status);
    expect(db.calls[0].params).toMatchObject({ id: "2" });
  });
});

describe("company.controller create", () => {
  it("derives a URL-safe key and creates the company", async () => {
    // Arrange
    db.reset([rows(), rows({ id: 5 })]);

    // Act
    const res = await call("post", "/companies").send({ name: "Acme Health, Inc." });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: "Company created.", id: 5 });
    expect(db.calls[1].params).toMatchObject({
      name: "Acme Health, Inc.", key: "acme-health-inc", plan: "STARTUP", city: null, actorId: 1,
    });
  });

  it.each([
    [{}, [], 400],
    [{ name: "Acme" }, [rows({ id: 1 })], 409],
    [{ name: "Acme" }, [rows(), uniqueViolation()], 409],
  ])("rejects a company create %p", async (body, responses, status) => {
    // Arrange
    db.reset(responses);

    // Act
    const res = await call("post", "/companies").send(body);

    // Assert
    expect(res.status).toBe(status);
  });

  it("answers 409 with the duplicate-key message", async () => {
    // Arrange
    db.reset([rows({ id: 1 })]);

    // Act
    const res = await call("post", "/companies").send({ name: "Acme", key: "acme" });

    // Assert
    expect(res.body)
      .toEqual({ success: false, message: "A company with this key already exists." });
  });
});

describe("company.controller update, status and delete", () => {
  it.each([
    [[rows()], 404],
    [[rows({ id: 2 }), affected(1)], 200],
  ])("updates a company", async (responses, status) => {
    // Arrange
    db.reset(responses);

    // Act
    const res = await call("put", "/companies/2").send({ name: "New" });

    // Assert
    expect(res.status).toBe(status);
  });

  it("writes every column, defaulting missing ones to NULL and isActive to true", async () => {
    // Arrange
    db.reset([rows({ id: 2 }), affected(1)]);

    // Act
    const res = await call("put", "/companies/2").send({ name: "New", key: "new" });

    // Assert
    expect(res.body).toEqual({ success: true, message: "Company updated." });
    expect(db.calls[1].params).toMatchObject({
      id: "2", name: "New", key: "new", plan: null, isActive: true, actorId: 1,
    });
  });

  it.each([
    [{ isActive: true }, 200, "Company activated."],
    [{ isActive: false }, 200, "Company deactivated."],
    [{}, 400, "isActive is required."],
  ])("toggles company status %p", async (body, status, message) => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const res = await call("patch", "/companies/2/status").send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
  });

  it("soft-deletes a company", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const res = await call("delete", "/companies/2");

    // Assert
    expect(res.body.message).toBe("Company deleted.");
    expect(db.calls[0].text).toContain("is_deleted = true, is_active = false");
  });

  it.each([
    ["get", "/companies"],
    ["get", "/companies/2"],
    ["post", "/companies"],
    ["put", "/companies/2"],
    ["patch", "/companies/2/status"],
    ["delete", "/companies/2"],
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    db.reset([new Error("db down")]);

    // Act
    const res = await call(method, url).send({ name: "Acme", isActive: true });

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Database error." });
  });
});
