const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const request = require("supertest");
const app = require("../app");
const {
  XHR, USERS, authCookie, mockPool, rows, affected,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.admin) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_MANAGER = { email: "mgr@example.com", password: "Str0ng!Pass" };
const MANAGER_AND_COMPANY = "RoleId IN (SELECT Id FROM Roles WHERE Code = @roleCode)"
  + " AND CompanyId = @scopeCompanyId";

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("manager.controller tenant and role scoping", () => {
  it("lists managers of the ADMIN's company by role code", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 20 })]);

    // Act
    const res = await call("get", "/managers");

    // Assert
    expect(res.body.data).toEqual([{ Id: 20 }]);
    expect(db.queries[0].inputs).toMatchObject({ roleCode: "MANAGER", scopeCompanyId: 2 });
    expect(db.queries[0].text).not.toContain("r.Name = 'Manager'");
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 20 })], 200],
  ])("reads one manager within scope", async (responses, status) => {
    // Arrange
    mockPool(mockConnectDb, responses);

    // Act
    const res = await call("get", "/managers/20");

    // Assert
    expect(res.status).toBe(status);
  });

  it("creates a manager in the ADMIN's company by role code", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows(), rows({ Id: 21 })]);

    // Act
    const res = await call("post", "/managers").send(NEW_MANAGER);

    // Assert
    expect(res.status).toBe(201);
    expect(db.queries[1].inputs).toMatchObject({ companyId: 2, roleCode: "MANAGER" });
    expect(db.queries[1].text).toContain("FROM Roles r WHERE r.Code = @roleCode");
  });

  it.each([
    ["no email", { password: "Str0ng!Pass" }, 400],
    ["no password", { email: "mgr@example.com" }, 400],
    ["another company", { ...NEW_MANAGER, companyId: 3 }, 403],
  ])("rejects a create with %s", async (_label, body, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/managers").send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries).toHaveLength(0);
  });

  it("returns 409 for an email already in use", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 1 })]);

    // Act
    const res = await call("post", "/managers").send(NEW_MANAGER);

    // Assert
    expect(res.status).toBe(409);
  });

  it("returns 404 when an ADMIN rewrites a non-manager or another company's user "
    + "through /managers", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(0)]);

    // Act
    const res = await call("put", "/managers/1").send({ companyId: 2, email: "x@example.com" });

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[0].text)
      .toContain(`WHERE Id = @id AND IsDeleted = 0 AND ${MANAGER_AND_COMPANY}`);
  });

  it("updates a manager in scope", async () => {
    // Arrange
    mockPool(mockConnectDb, [affected(1)]);

    // Act
    const res = await call("put", "/managers/20").send({ firstName: "M" });

    // Assert
    expect(res.body).toEqual({ success: true, message: "Manager updated." });
  });

  it("returns 403 when an ADMIN moves a manager to another company", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("put", "/managers/20").send({ companyId: 9 });

    // Assert
    expect(res.status).toBe(403);
  });

  it.each([
    [{ isActive: true }, 1, "Manager activated."],
    [{ isActive: false }, 1, "Manager deactivated."],
    [{ isActive: false }, 0, "Manager not found."],
  ])("toggles status %p within scope", async (body, count, message) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("patch", "/managers/20/status").send(body);

    // Assert
    expect(res.body.message).toBe(message);
    expect(db.queries[0].text).toContain(MANAGER_AND_COMPANY);
  });

  it("requires isActive to toggle status", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("patch", "/managers/20/status").send({});

    // Assert
    expect(res.status).toBe(400);
  });

  it.each([
    [1, 200],
    [0, 404],
  ])("deletes a manager within scope (rows affected %i)", async (count, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("delete", "/managers/20");

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries[0].text).toContain(MANAGER_AND_COMPANY);
  });

  it("refuses to delete the caller's own account", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("delete", `/managers/${USERS.admin.id}`);

    // Assert
    expect(res.status).toBe(403);
  });
});

describe("manager.controller database errors", () => {
  it.each([
    ["get", "/managers"],
    ["get", "/managers/20"],
    ["post", "/managers"],
    ["put", "/managers/20"],
    ["patch", "/managers/20/status"],
    ["delete", "/managers/20"],
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    mockPool(mockConnectDb, [new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin).send({ ...NEW_MANAGER, isActive: true });

    // Assert
    expect(res.status).toBe(500);
  });
});
