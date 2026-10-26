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

const ADMIN_SCOPE = "company_id = @scopeCompanyId"
  + " AND role_id NOT IN (SELECT id FROM roles WHERE code = @superAdminCode)";

beforeEach(() => {
  db.reset();
});

describe("user.controller reads", () => {
  it("lists only the ADMIN's own company and never SUPER_ADMIN accounts", async () => {
    // Arrange
    db.reset([rows({ Id: 5, FirstName: "A" })]);

    // Act
    const res = await call("get", "/users");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ Id: 5, FirstName: "A" }] });
    expect(db.calls[0].text).toContain(`u.${ADMIN_SCOPE.replace("role_id", "u.role_id")}`);
    expect(db.calls[0].text).toContain("u.first_name AS \"FirstName\"");
    expect(db.calls[0].text).toContain("ORDER BY u.created_at DESC");
    expect(db.calls[0].params)
      .toMatchObject({ scopeCompanyId: 2, superAdminCode: "SUPER_ADMIN" });
  });

  it("lists every user for a SUPER_ADMIN", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await call("get", "/users", USERS.superAdmin);

    // Assert
    expect(res.status).toBe(200);
    expect(db.calls[0].text).not.toContain("@scopeCompanyId");
    expect(db.calls[0].text).toContain("AND TRUE");
  });

  it("returns 404 when an ADMIN reads a user outside their scope", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await call("get", "/users/1");

    // Assert
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "User not found." });
    expect(db.calls[0].params).toMatchObject({ id: "1", scopeCompanyId: 2 });
  });

  it("returns a user in scope", async () => {
    // Arrange
    db.reset([rows({ Id: 7 })]);

    // Act
    const res = await call("get", "/users/7");

    // Assert
    expect(res.body).toEqual({ success: true, data: { Id: 7 } });
  });

  it("shows an ADMIN only their own company in the company list", async () => {
    // Arrange
    db.reset([rows({ Id: 2, Name: "Globex" })]);

    // Act
    const res = await call("get", "/users/companies");

    // Assert
    expect(res.body.data).toEqual([{ Id: 2, Name: "Globex" }]);
    expect(db.calls[0].text).toContain("id = @scopeCompanyId");
    expect(db.calls[0].text).toContain("key AS \"Key\"");
  });

  it("lists roles with their PascalCase keys", async () => {
    // Arrange
    db.reset([rows({ Id: 1, Code: "ADMIN" })]);

    // Act
    const res = await call("get", "/users/roles");

    // Assert
    expect(res.body.data).toEqual([{ Id: 1, Code: "ADMIN" }]);
    expect(db.calls[0].text).toContain("description AS \"Description\"");
  });
});

describe("user.controller update", () => {
  it("returns 404 and runs no UPDATE when an ADMIN edits a SUPER_ADMIN "
    + "or another company's user", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await call("put", "/users/1")
      .send({ companyId: 2, roleId: 3, email: "evil@example.com" });

    // Assert
    expect(res.status).toBe(404);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toMatch(/^SELECT id FROM users/);
    expect(db.calls[0].text).toContain(ADMIN_SCOPE);
  });

  it("returns 403 without touching the DB when an ADMIN moves a user "
    + "to another company", async () => {
    // Act
    const res = await call("put", "/users/7").send({ companyId: 3, roleId: 3 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when an ADMIN promotes a user to SUPER_ADMIN", async () => {
    // Arrange
    db.reset([rows({ id: 7 }), rows({ code: "SUPER_ADMIN" })]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: 2, roleId: 1 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(2);
    expect(db.calls[1].params).toEqual({ roleId: 1 });
  });

  it("updates an in-scope user, defaulting an empty company to the ADMIN's own", async () => {
    // Arrange
    db.reset([rows({ id: 7 }), rows({ code: "EMPLOYEE" }), affected(1)]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: "", roleId: 3, firstName: "A" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "User updated." });
    const update = db.calls[2];
    expect(update.text).toContain(`WHERE id = @id AND NOT is_deleted AND ${ADMIN_SCOPE}`);
    expect(update.text).toContain("company_id = COALESCE(@companyId, company_id)");
    expect(update.params).toMatchObject({
      id: "7", companyId: 2, roleId: 3, firstName: "A", isActive: true, updatedBy: 10,
    });
  });

  it("stores an empty manager from the form as NULL, not 0 (fk_users_manager)", async () => {
    // Arrange
    db.reset([rows({ id: 7 }), rows({ code: "MANAGER" }), affected(1)]);

    // Act
    const res = await call("put", "/users/7")
      .send({
        companyId: 2, roleId: "4", managerId: "", isActive: "false",
      });

    // Assert
    expect(res.status).toBe(200);
    expect(db.calls[2].params).toMatchObject({ roleId: 4, managerId: null, isActive: false });
  });

  it("resets the password: Argon2id, revokes sessions, audits, never echoes it", async () => {
    // Arrange
    db.reset([
      rows({ id: 7 }), rows({ code: "EMPLOYEE" }),
      affected(1), affected(1), affected(2), affected(1),
    ]);

    // Act
    const res = await call("put", "/users/7")
      .send({ companyId: 2, roleId: 3, password: "N3w-Passw0rd" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message)
      .toBe("User updated. Password changed and all their sessions were signed out.");
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const statements = db.statements();
    expect(statements[3].text).toContain("password_hash = @passwordHash");
    expect(statements[3].params.passwordHash).toMatch(/^\$argon2id\$/);
    expect(statements[4].text).toContain("UPDATE refresh_tokens");
    expect(statements[5].params).toMatchObject({ eventType: "USER_PASSWORD_RESET", entityId: "7" });
    expect(JSON.stringify(db.calls)).not.toContain("N3w-Passw0rd");
  });

  it("rejects a too-short new password with 400 before touching the DB", async () => {
    // Act
    const res = await call("put", "/users/7").send({ companyId: 2, password: "short" });

    // Assert
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it("keeps the current password when New Password is left empty", async () => {
    // Arrange
    db.reset([rows({ id: 7 }), rows({ code: "EMPLOYEE" }), affected(1)]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: 2, roleId: 3, password: "" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("User updated.");
    expect(db.calls).toHaveLength(3);
    expect(db.calls.map((q) => q.text).join(" ")).not.toContain("password_hash");
  });

  it("returns 404 when the scoped UPDATE matches no row", async () => {
    // Arrange
    db.reset([rows({ id: 7 }), affected(0)]);

    // Act
    const res = await call("put", "/users/7").send({ companyId: 2 });

    // Assert
    expect(res.status).toBe(404);
  });
});

describe("user.controller delete", () => {
  it("returns 404 when an ADMIN deletes a SUPER_ADMIN or another company's user", async () => {
    // Arrange
    db.reset([affected(0)]);

    // Act
    const res = await call("delete", "/users/1");

    // Assert
    expect(res.status).toBe(404);
    expect(db.calls[0].text).toContain(ADMIN_SCOPE);
  });

  it("soft-deletes an in-scope user and records who deleted it", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const res = await call("delete", "/users/7");

    // Assert
    expect(res.body).toEqual({ success: true, message: "User deleted." });
    expect(db.calls[0].text).toContain("is_deleted = true, is_active = false");
    expect(db.calls[0].params).toMatchObject({ id: "7", updatedBy: 10 });
  });

  it("refuses to delete the caller's own account", async () => {
    // Act
    const res = await call("delete", `/users/${USERS.admin.id}`);

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });
});
