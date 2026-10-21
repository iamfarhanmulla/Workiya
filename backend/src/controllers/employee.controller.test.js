const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const request = require("supertest");
const app = require("../app");
const {
  XHR, USERS, authCookie, mockPool, rows, affected,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.manager) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_EMPLOYEE = { email: "emp@example.com", password: "Str0ng!Pass", firstName: "E" };
const EMPLOYEE_AND_COMPANY = "RoleId IN (SELECT Id FROM Roles WHERE Code = @roleCode)"
  + " AND CompanyId = @scopeCompanyId";

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("employee.controller tenant and role scoping", () => {
  it("lists employees of the caller's company by role code, not a hard-coded RoleId", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 30 })]);

    // Act
    const res = await call("get", "/employees");

    // Assert
    expect(res.body).toEqual({ success: true, data: [{ Id: 30 }] });
    expect(db.queries[0].text)
      .toContain(`u.${EMPLOYEE_AND_COMPANY.replace("CompanyId", "u.CompanyId")}`);
    expect(db.queries[0].text).not.toMatch(/RoleId = \d/);
    expect(db.queries[0].inputs).toMatchObject({ roleCode: "EMPLOYEE", scopeCompanyId: 2 });
  });

  it("returns 404 for an id that is not an employee of the caller's company", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows()]);

    // Act
    const res = await call("get", "/employees/1");

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns an employee in scope", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 30 })]);

    // Act
    const res = await call("get", "/employees/30");

    // Assert
    expect(res.body.data).toEqual({ Id: 30 });
  });

  it("lets a MANAGER create an employee without picking a company, "
    + "filed under their own", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows(), rows({ Id: 31 })]);

    // Act
    const res = await call("post", "/employees").send({ ...NEW_EMPLOYEE, companyId: "" });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(31);
    const insert = db.queries[1];
    expect(insert.text).toContain("FROM Roles r WHERE r.Code = @roleCode");
    expect(insert.inputs).toMatchObject({ companyId: 2, roleCode: "EMPLOYEE", username: "emp" });
    expect(Object.values(insert.inputs)).not.toContain("Str0ng!Pass");
  });

  it.each([
    ["no password", { email: "emp@example.com" }],
    ["a short password", { email: "emp@example.com", password: "short" }],
  ])("requires a real password instead of a default (%s)", async (_label, body) => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/employees").send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 8/);
    expect(db.queries).toHaveLength(0);
  });

  it("returns 400 without an email", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/employees").send({ password: "Str0ng!Pass" });

    // Assert
    expect(res.status).toBe(400);
  });

  it("returns 403 when a MANAGER creates an employee in another company", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/employees").send({ ...NEW_EMPLOYEE, companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 409 for an email already in use", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ Id: 1 })]);

    // Act
    const res = await call("post", "/employees").send(NEW_EMPLOYEE);

    // Assert
    expect(res.status).toBe(409);
  });

  it("returns 404 when a MANAGER edits an ADMIN, "
    + "a SUPER_ADMIN or another company's user", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(0)]);

    // Act
    const res = await call("put", "/employees/1")
      .send({ companyId: 2, email: "attacker@example.com", isActive: 0 });

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[0].text)
      .toContain(`WHERE Id = @id AND IsDeleted = 0 AND ${EMPLOYEE_AND_COMPANY}`);
  });

  it("updates an employee in scope", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    const res = await call("put", "/employees/30").send({ companyId: "", firstName: "New" });

    // Assert
    expect(res.status).toBe(200);
    expect(db.queries[0].inputs).toMatchObject({ companyId: 2, firstName: "New" });
  });

  it("returns 403 when a MANAGER moves an employee to another company", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("put", "/employees/30").send({ companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
  });

  it.each([
    [{ isActive: false }, 1, 200, "Employee deactivated."],
    [{ isActive: true }, 1, 200, "Employee activated."],
    [{ isActive: true }, 0, 404, "Employee not found."],
  ])("toggles status %p only within the caller's company", async (body, count, status, message) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("patch", "/employees/30/status").send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
    expect(db.queries[0].text).toContain(EMPLOYEE_AND_COMPANY);
  });

  it("requires isActive to toggle status", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("patch", "/employees/30/status").send({});

    // Assert
    expect(res.status).toBe(400);
  });

  it.each([
    [1, 200],
    [0, 404],
  ])("lets an ADMIN delete an employee of their company "
    + "(rows affected %i)", async (count, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("delete", "/employees/30", USERS.admin);

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries[0].text).toContain(EMPLOYEE_AND_COMPANY);
  });

  it("refuses to delete the caller's own account", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("delete", `/employees/${USERS.admin.id}`, USERS.admin);

    // Assert
    expect(res.status).toBe(403);
  });

  it("lists managers of the caller's company for the dropdown", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 20 })]);

    // Act
    const res = await call("get", "/employees/managers-list");

    // Assert
    expect(res.body.data).toEqual([{ Id: 20 }]);
    expect(db.queries[0].inputs).toMatchObject({ roleCode: "MANAGER", scopeCompanyId: 2 });
    expect(db.queries[0].text).not.toMatch(/RoleId = \d/);
  });

  it("does not scope a SUPER_ADMIN by company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    await call("get", "/employees", USERS.superAdmin);

    // Assert
    expect(db.queries[0].inputs).not.toHaveProperty("scopeCompanyId");
  });
});

describe("employee.controller database errors", () => {
  it.each([
    ["get", "/employees"],
    ["get", "/employees/30"],
    ["post", "/employees"],
    ["put", "/employees/30"],
    ["patch", "/employees/30/status"],
    ["delete", "/employees/30"],
    ["get", "/employees/managers-list"],
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    mockPool(mockConnectDb, [new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin).send({ ...NEW_EMPLOYEE, isActive: true });

    // Assert
    expect(res.status).toBe(500);
  });
});
