jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const request = require("supertest");
const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.admin) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_USER = { email: "new@example.com", password: "Str0ng!Pass", roleId: 3 };

beforeEach(() => {
  db.reset();
});

describe("user.controller create", () => {
  it.each([
    ["no email", { password: "Str0ng!Pass", roleId: 3 }, /required/],
    ["a short password", { ...NEW_USER, password: "short" }, /at least 8/],
  ])("returns 400 for %s", async (_label, body, message) => {
    // Act
    const res = await call("post", "/users").send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it("returns 403 when an ADMIN creates a user in another company", async () => {
    // Act
    const res = await call("post", "/users").send({ ...NEW_USER, companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when an ADMIN creates a SUPER_ADMIN", async () => {
    // Arrange
    db.reset([rows({ code: "SUPER_ADMIN" })]);

    // Act
    const res = await call("post", "/users").send({ ...NEW_USER, roleId: 1 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(1);
  });

  it("returns 409 for an email already in use", async () => {
    // Arrange
    db.reset([rows({ code: "EMPLOYEE" }), rows({ "?column?": 1 })]);

    // Act
    const res = await call("post", "/users").send(NEW_USER);

    // Assert
    expect(res.status).toBe(409);
    expect(db.calls[1].params).toEqual({ email: "new@example.com" });
  });

  it("creates the user in the ADMIN's company with an Argon2id hash "
    + "and no plain password", async () => {
    // Arrange
    db.reset([rows({ code: "EMPLOYEE" }), rows(), rows({ id: 42 })]);

    // Act
    const res = await call("post", "/users").send(NEW_USER);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: "User created.", id: 42 });
    const insert = db.calls[2].params;
    expect(insert).toMatchObject({
      companyId: 2,
      roleId: 3,
      email: "new@example.com",
      passwordSalt: "",
      passwordIterations: 0,
      managerId: null,
      createdBy: 10,
    });
    expect(insert.passwordHash).toMatch(/^\$argon2id\$/);
    expect(Object.values(insert)).not.toContain("Str0ng!Pass");
  });

  it("lets a SUPER_ADMIN create a user in a chosen company", async () => {
    // Arrange
    db.reset([rows(), rows({ id: 43 })]);

    // Act
    const res = await call("post", "/users", USERS.superAdmin)
      .send({ ...NEW_USER, roleId: 1, companyId: 1 });

    // Assert
    expect(res.status).toBe(201);
    expect(db.calls[1].params.companyId).toBe(1);
  });

  it("returns 400 when a SUPER_ADMIN leaves the company empty", async () => {
    // Act
    const res = await call("post", "/users", USERS.superAdmin).send({ ...NEW_USER, roleId: 1 });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Company is required." });
    expect(db.calls).toHaveLength(0);
  });
});

describe("user.controller database errors", () => {
  it.each([
    ["get", "/users"],
    ["get", "/users/7"],
    ["post", "/users"],
    ["put", "/users/7"],
    ["delete", "/users/7"],
    ["get", "/users/roles"],
    ["get", "/users/companies"],
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    db.reset([new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin).send({ ...NEW_USER, companyId: 2 });

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Database error." });
  });
});
