const request = require("supertest");

jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const app = require("../app");
const { ROLES } = require("../constants/roles");
const {
  XHR, USERS, authCookie, rows,
} = require("../../test/helpers/apiHarness");

describe("resource route guards", () => {
  beforeEach(() => {
    db.reset();
  });

  it("returns 403 when an EMPLOYEE creates a company", async () => {
    // Act
    const res = await request(app)
      .post("/api/v1/companies")
      .set("Cookie", authCookie(USERS.employee))
      .set(XHR)
      .send({ name: "Acme" });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when a MANAGER deletes an employee", async () => {
    // Act
    const res = await request(app)
      .delete("/api/v1/employees/5")
      .set("Cookie", authCookie(USERS.manager))
      .set(XHR);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when an ADMIN creates a SUPER_ADMIN user", async () => {
    // Arrange
    db.reset([rows({ code: ROLES.SUPER_ADMIN })]);

    // Act
    const res = await request(app)
      .post("/api/v1/users")
      .set("Cookie", authCookie(USERS.admin))
      .set(XHR)
      .send({
        email: "new@example.com", password: "Str0ng!Passw0rd", roleId: 1, companyId: 2,
      });

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false, message: "You are not allowed to assign this role or company.",
    });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).not.toMatch(/INSERT/i);
  });

  it.each(["/api/v1/doctors", "/api/v1/tasks"])("returns 404 for removed %s", async (path) => {
    // Act
    const res = await request(app)
      .get(path)
      .set("Cookie", authCookie(USERS.admin));

    // Assert
    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe("NOT_FOUND");
    expect(db.calls).toHaveLength(0);
  });
});
