jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const request = require("supertest");
const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.manager) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_EMPLOYEE = { email: "emp@example.com", password: "Str0ng!Pass", firstName: "E" };
const EMPLOYEE_AND_COMPANY = "role_id IN (SELECT id FROM roles WHERE code = @roleCode)"
  + " AND company_id = @scopeCompanyId";

beforeEach(() => {
  db.reset();
});

describe("employee.controller reads", () => {
  it("lists employees of the caller's company by role code, not a hard-coded role id", async () => {
    // Arrange
    db.reset([rows({ Id: 30, TaskCount: 2, TaskDone: 1 })]);

    // Act
    const res = await call("get", "/employees");

    // Assert
    expect(res.body).toEqual({ success: true, data: [{ Id: 30, TaskCount: 2, TaskDone: 1 }] });
    expect(db.calls[0].text)
      .toContain(`u.${EMPLOYEE_AND_COMPANY.replace("company_id", "u.company_id")}`);
    expect(db.calls[0].text).toContain("FROM activities a");
    expect(db.calls[0].text).not.toMatch(/role_id = \d/);
    expect(db.calls[0].params).toMatchObject({
      roleCode: "EMPLOYEE", scopeCompanyId: 2, completedStatus: "Completed",
    });
  });

  it("returns 404 for an id that is not an employee of the caller's company", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await call("get", "/employees/1");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Employee not found." });
  });

  it("returns an employee in scope", async () => {
    // Arrange
    db.reset([rows({ Id: 30 })]);

    // Act
    const res = await call("get", "/employees/30");

    // Assert
    expect(res.body.data).toEqual({ Id: 30 });
  });

  it("does not scope a SUPER_ADMIN by company", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    await call("get", "/employees", USERS.superAdmin);

    // Assert
    expect(db.calls[0].params).not.toHaveProperty("scopeCompanyId");
  });

  it("lists managers of the caller's company for the dropdown", async () => {
    // Arrange
    db.reset([rows({ Id: 20, Name: "Max Manager" })]);

    // Act
    const res = await call("get", "/employees/managers-list");

    // Assert
    expect(res.body.data).toEqual([{ Id: 20, Name: "Max Manager" }]);
    expect(db.calls[0].params).toMatchObject({ roleCode: "MANAGER", scopeCompanyId: 2 });
    expect(db.calls[0].text).toContain("c.name AS \"CompanyName\"");
  });
});

describe("employee.controller update", () => {
  it("returns 404 when a MANAGER edits an ADMIN, "
    + "a SUPER_ADMIN or another company's user", async () => {
    // Arrange
    db.reset([affected(0)]);

    // Act
    const res = await call("put", "/employees/1")
      .send({ companyId: 2, email: "attacker@example.com", isActive: 0 });

    // Assert
    expect(res.status).toBe(404);
    expect(db.calls[0].text)
      .toContain(`WHERE id = @id AND NOT is_deleted AND ${EMPLOYEE_AND_COMPANY}`);
  });

  it("updates an employee in scope", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const res = await call("put", "/employees/30").send({ companyId: "", firstName: "New" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Employee updated." });
    expect(db.calls[0].params).toMatchObject({ companyId: 2, firstName: "New", isActive: true });
  });

  it("stores an empty manager from the form as NULL, not 0 (fk_users_manager)", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const res = await call("put", "/employees/30").send({ companyId: 2, managerId: "" });

    // Assert
    expect(res.status).toBe(200);
    expect(db.calls[0].params).toMatchObject({ managerId: null });
  });

  it("resets the employee's password and signs out their sessions", async () => {
    // Arrange
    db.reset([affected(1), affected(1), affected(1), affected(1)]);

    // Act
    const res = await call("put", "/employees/30").send({ companyId: 2, password: "N3w-Passw0rd" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message)
      .toBe("Employee updated. Password changed and all their sessions were signed out.");
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const statements = db.statements();
    expect(statements[1].text).toContain("password_hash = @passwordHash");
    expect(statements[2].text).toContain("UPDATE refresh_tokens");
    expect(JSON.stringify(db.calls)).not.toContain("N3w-Passw0rd");
  });

  it("rejects a too-short new employee password with 400", async () => {
    // Act
    const res = await call("put", "/employees/30").send({ companyId: 2, password: "short" });

    // Assert
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when a MANAGER moves an employee to another company", async () => {
    // Act
    const res = await call("put", "/employees/30").send({ companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
  });
});

describe("employee.controller status and delete", () => {
  it.each([
    [{ isActive: false }, 1, 200, "Employee deactivated.", false],
    [{ isActive: true }, 1, 200, "Employee activated.", true],
    [{ isActive: true }, 0, 404, "Employee not found.", true],
  ])("toggles status %p only within the caller's company", async (
    body,
    count,
    status,
    message,
    stored,
  ) => {
    // Arrange
    db.reset([affected(count)]);

    // Act
    const res = await call("patch", "/employees/30/status").send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
    expect(db.calls[0].text).toContain(EMPLOYEE_AND_COMPANY);
    expect(db.calls[0].params.isActive).toBe(stored);
  });

  it("requires isActive to toggle status", async () => {
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
    db.reset([affected(count)]);

    // Act
    const res = await call("delete", "/employees/30", USERS.admin);

    // Assert
    expect(res.status).toBe(status);
    expect(db.calls[0].text).toContain(EMPLOYEE_AND_COMPANY);
  });

  it("refuses to delete the caller's own account", async () => {
    // Act
    const res = await call("delete", `/employees/${USERS.admin.id}`, USERS.admin);

    // Assert
    expect(res.status).toBe(403);
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
    db.reset([new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin)
      .send({ ...NEW_EMPLOYEE, companyId: 2, isActive: true });

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Database error." });
  });
});
