jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const request = require("supertest");
const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.admin) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_MANAGER = { email: "mgr@example.com", password: "Str0ng!Pass" };
const MANAGER_AND_COMPANY = "role_id IN (SELECT id FROM roles WHERE code = @roleCode)"
  + " AND company_id = @scopeCompanyId";

beforeEach(() => {
  db.reset();
});

describe("manager.controller reads", () => {
  it("lists managers of the ADMIN's company by role code", async () => {
    // Arrange
    db.reset([rows({ Id: 20, EmployeeCount: 1, TaskCount: 0 })]);

    // Act
    const res = await call("get", "/managers");

    // Assert
    expect(res.body.data).toEqual([{ Id: 20, EmployeeCount: 1, TaskCount: 0 }]);
    expect(db.calls[0].params).toMatchObject({ roleCode: "MANAGER", scopeCompanyId: 2 });
    expect(db.calls[0].text).toContain("AS \"EmployeeCount\"");
    expect(db.calls[0].text).toContain("a.assigned_by = u.id");
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 20 })], 200],
  ])("reads one manager within scope", async (responses, status) => {
    // Arrange
    db.reset(responses);

    // Act
    const res = await call("get", "/managers/20");

    // Assert
    expect(res.status).toBe(status);
  });
});

describe("manager.controller create", () => {
  it("creates a manager in the ADMIN's company by role code", async () => {
    // Arrange
    db.reset([rows(), rows({ id: 4 }), rows({ id: 21 })]);

    // Act
    const res = await call("post", "/managers").send(NEW_MANAGER);

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: "Manager created.", id: 21 });
    expect(db.calls[1].params).toEqual({ code: "MANAGER" });
    expect(db.calls[2].params).toMatchObject({
      companyId: 2, roleId: 4, managerId: null, username: "mgr", passwordIterations: 0,
    });
  });

  it("returns 500 when the MANAGER role is missing", async () => {
    // Arrange
    db.reset([rows(), rows()]);

    // Act
    const res = await call("post", "/managers").send(NEW_MANAGER);

    // Assert
    expect(res.status).toBe(500);
  });

  it.each([
    ["no email", { password: "Str0ng!Pass" }, 400, USERS.admin],
    ["no password", { email: "mgr@example.com" }, 400, USERS.admin],
    ["another company", { ...NEW_MANAGER, companyId: 3 }, 403, USERS.admin],
    ["no company from a SUPER_ADMIN", NEW_MANAGER, 400, USERS.superAdmin],
  ])("rejects a create with %s", async (_label, body, status, user) => {
    // Act
    const res = await call("post", "/managers", user).send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 409 for an email already in use", async () => {
    // Arrange
    db.reset([rows({ "?column?": 1 })]);

    // Act
    const res = await call("post", "/managers").send(NEW_MANAGER);

    // Assert
    expect(res.status).toBe(409);
  });
});

describe("manager.controller update", () => {
  it("returns 404 when an ADMIN rewrites a non-manager or another company's user "
    + "through /managers", async () => {
    // Arrange
    db.reset([affected(0)]);

    // Act
    const res = await call("put", "/managers/1").send({ companyId: 2, email: "x@example.com" });

    // Assert
    expect(res.status).toBe(404);
    expect(db.calls[0].text)
      .toContain(`WHERE id = @id AND NOT is_deleted AND ${MANAGER_AND_COMPANY}`);
    expect(db.calls[0].text).not.toContain("manager_id");
  });

  it("resets the manager's password and signs out their sessions", async () => {
    // Arrange
    db.reset([affected(1), affected(1), affected(1), affected(1)]);

    // Act
    const res = await call("put", "/managers/40").send({ companyId: 2, password: "N3w-Passw0rd" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message)
      .toBe("Manager updated. Password changed and all their sessions were signed out.");
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const statements = db.statements();
    expect(statements[1].text).toContain("password_hash = @passwordHash");
    expect(statements[2].text).toContain("UPDATE refresh_tokens");
    expect(JSON.stringify(db.calls)).not.toContain("N3w-Passw0rd");
  });

  it("rejects a too-short new manager password with 400", async () => {
    // Act
    const res = await call("put", "/managers/40").send({ companyId: 2, password: "short" });

    // Assert
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it("updates a manager in scope", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const res = await call("put", "/managers/20").send({ firstName: "M" });

    // Assert
    expect(res.body).toEqual({ success: true, message: "Manager updated." });
    expect(db.calls[0].params).toMatchObject({ firstName: "M", companyId: 2, lastName: null });
  });

  it("returns 403 when an ADMIN moves a manager to another company", async () => {
    // Act
    const res = await call("put", "/managers/20").send({ companyId: 9 });

    // Assert
    expect(res.status).toBe(403);
  });
});

describe("manager.controller status and delete", () => {
  it.each([
    [{ isActive: true }, 1, "Manager activated."],
    [{ isActive: false }, 1, "Manager deactivated."],
    [{ isActive: false }, 0, "Manager not found."],
  ])("toggles status %p within scope", async (body, count, message) => {
    // Arrange
    db.reset([affected(count)]);

    // Act
    const res = await call("patch", "/managers/20/status").send(body);

    // Assert
    expect(res.body.message).toBe(message);
    expect(db.calls[0].text).toContain(MANAGER_AND_COMPANY);
  });

  it("requires isActive to toggle status", async () => {
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
    db.reset([affected(count)]);

    // Act
    const res = await call("delete", "/managers/20");

    // Assert
    expect(res.status).toBe(status);
    expect(db.calls[0].text).toContain(MANAGER_AND_COMPANY);
  });

  it("refuses to delete the caller's own account", async () => {
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
    db.reset([new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin)
      .send({ ...NEW_MANAGER, companyId: 2, isActive: true });

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: "Database error." });
  });
});
