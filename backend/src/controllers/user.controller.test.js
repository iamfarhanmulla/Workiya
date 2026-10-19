const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const request = require("supertest");
const app = require("../app");
const { XHR, USERS, authCookie, mockPool, rows, affected } = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.admin) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_USER = { email: "new@example.com", password: "Str0ng!Pass", roleId: 3 };

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("user.controller tenant scoping", () => {
  it("lists only the ADMIN's own company and never SUPER_ADMIN accounts", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 5 })]);

    // Act
    const res = await call("get", "/users");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ Id: 5 }] });
    expect(db.queries[0].text).toContain("u.CompanyId = @scopeCompanyId");
    expect(db.queries[0].text).toContain("u.RoleId NOT IN (SELECT Id FROM Roles WHERE Code = @superAdminCode)");
    expect(db.queries[0].inputs).toMatchObject({ scopeCompanyId: 2, superAdminCode: "SUPER_ADMIN" });
  });

  it("lists every user for a SUPER_ADMIN", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    const res = await call("get", "/users", USERS.superAdmin);

    // Assert
    expect(res.status).toBe(200);
    expect(db.queries[0].text).not.toContain("@scopeCompanyId");
  });

  it("returns 404 when an ADMIN reads a user outside their scope", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    const res = await call("get", "/users/1");

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[0].inputs).toMatchObject({ id: "1", scopeCompanyId: 2 });
  });

  it("returns a user in scope", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 7 })]);

    // Act
    const res = await call("get", "/users/7");

    // Assert
    expect(res.body).toEqual({ success: true, data: { Id: 7 } });
  });

  it("returns 404 and runs no UPDATE when an ADMIN edits a SUPER_ADMIN or another company's user", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    const res = await call("put", "/users/1").send({ companyId: 2, roleId: 3, email: "evil@example.com" });

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].text).toMatch(/^SELECT Id FROM Users/);
    expect(db.queries[0].inputs).toMatchObject({ scopeCompanyId: 2, superAdminCode: "SUPER_ADMIN" });
  });

  it("returns 403 without touching the DB when an ADMIN moves a user to another company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call("put", "/users/7").send({ companyId: 3, roleId: 3 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(0);
  });

  it("returns 403 when an ADMIN promotes a user to SUPER_ADMIN", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 7 }), rows({ Code: "SUPER_ADMIN" })]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: 2, roleId: 1 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(2);
  });

  it("updates an in-scope user, defaulting an empty company to the ADMIN's own", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 7 }), rows({ Code: "EMPLOYEE" }), affected(1)]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: "", roleId: 3, firstName: "A" });

    // Assert
    expect(res.status).toBe(200);
    const update = db.queries[2];
    expect(update.text).toContain("WHERE Id = @id AND IsDeleted = 0 AND CompanyId = @scopeCompanyId");
    expect(update.inputs).toMatchObject({ id: "7", companyId: 2, roleId: 3, firstName: "A", isActive: 1 });
  });

  it("returns 404 when the scoped UPDATE matches no row", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 7 }), affected(0)]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: 2 });

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 404 when an ADMIN deletes a SUPER_ADMIN or another company's user", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(0)]);

    // Act
    const res = await call("delete", "/users/1");

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[0].text).toContain("CompanyId = @scopeCompanyId");
    expect(db.queries[0].text).toContain("RoleId NOT IN");
  });

  it("soft-deletes an in-scope user", async () => {
    // Arrange
    mockPool(mockConnectDb, [affected(1)]);

    // Act
    const res = await call("delete", "/users/7");

    // Assert
    expect(res.body).toEqual({ success: true, message: "User deleted." });
  });

  it("refuses to delete the caller's own account", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call("delete", `/users/${USERS.admin.id}`);

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(0);
  });

  it("shows an ADMIN only their own company in the company list", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 2 })]);

    // Act
    const res = await call("get", "/users/companies");

    // Assert
    expect(res.body.data).toEqual([{ Id: 2 }]);
    expect(db.queries[0].text).toContain("Id = @scopeCompanyId");
  });

  it("lists roles", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 1, Code: "ADMIN" })]);

    // Act
    const res = await call("get", "/users/roles");

    // Assert
    expect(res.body.data).toEqual([{ Id: 1, Code: "ADMIN" }]);
  });
});

describe("user.controller create", () => {
  it.each([
    ["no email", { password: "Str0ng!Pass", roleId: 3 }, /required/],
    ["a short password", { ...NEW_USER, password: "short" }, /at least 8/]
  ])("returns 400 for %s", async (_label, body, message) => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/users").send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it("returns 403 when an ADMIN creates a user in another company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/users").send({ ...NEW_USER, companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(0);
  });

  it("returns 409 for an email already in use", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Code: "EMPLOYEE" }), rows({ Id: 9 })]);

    // Act
    const res = await call("post", "/users").send(NEW_USER);

    // Assert
    expect(res.status).toBe(409);
  });

  it("creates the user in the ADMIN's company with a PBKDF2 hash and no plain password", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Code: "EMPLOYEE" }), rows(), rows({ Id: 42 })]);

    // Act
    const res = await call("post", "/users").send(NEW_USER);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(42);
    const insert = db.queries[2].inputs;
    expect(insert).toMatchObject({ companyId: 2, roleId: 3, email: "new@example.com", passwordIterations: 10000 });
    expect(Object.values(insert)).not.toContain("Str0ng!Pass");
  });

  it("lets a SUPER_ADMIN create a user without a company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows(), rows({ Id: 43 })]);

    // Act
    const res = await call("post", "/users", USERS.superAdmin).send({ ...NEW_USER, roleId: 1 });

    // Assert
    expect(res.status).toBe(201);
    expect(db.queries[1].inputs.companyId).toBeNull();
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
    ["get", "/users/companies"]
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    mockPool(mockConnectDb, [new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin).send(NEW_USER);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Database error." });
  });
});
