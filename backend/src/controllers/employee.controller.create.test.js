jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const request = require("supertest");
const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.manager) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const NEW_EMPLOYEE = { email: "emp@example.com", password: "Str0ng!Pass", firstName: "E" };

beforeEach(() => {
  db.reset();
});

describe("employee.controller create", () => {
  it("lets a MANAGER create an employee without picking a company, "
    + "filed under their own", async () => {
    // Arrange
    db.reset([rows(), rows({ id: 3 }), rows({ id: 31 })]);

    // Act
    const res = await call("post", "/employees").send({ ...NEW_EMPLOYEE, companyId: "" });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: "Employee created.", id: 31 });
    expect(db.calls[1].params).toEqual({ code: "EMPLOYEE" });
    const insert = db.calls[2].params;
    expect(insert).toMatchObject({
      companyId: 2, roleId: 3, username: "emp", passwordIterations: 0, createdBy: 20,
    });
    expect(insert.passwordHash).toMatch(/^\$argon2id\$/);
    expect(Object.values(insert)).not.toContain("Str0ng!Pass");
  });

  it("returns 500 when the EMPLOYEE role is missing", async () => {
    // Arrange
    db.reset([rows(), rows()]);

    // Act
    const res = await call("post", "/employees").send(NEW_EMPLOYEE);

    // Assert
    expect(res.status).toBe(500);
    expect(db.calls).toHaveLength(2);
  });

  it.each([
    ["no password", { email: "emp@example.com" }],
    ["a short password", { email: "emp@example.com", password: "short" }],
  ])("requires a real password instead of a default (%s)", async (_label, body) => {
    // Act
    const res = await call("post", "/employees").send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 8/);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 400 without an email", async () => {
    // Act
    const res = await call("post", "/employees").send({ password: "Str0ng!Pass" });

    // Assert
    expect(res.status).toBe(400);
  });

  it("returns 400 when a SUPER_ADMIN leaves the company empty", async () => {
    // Act
    const res = await call("post", "/employees", USERS.superAdmin).send(NEW_EMPLOYEE);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Company is required.");
  });

  it("returns 403 when a MANAGER creates an employee in another company", async () => {
    // Act
    const res = await call("post", "/employees").send({ ...NEW_EMPLOYEE, companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 409 for an email already in use", async () => {
    // Arrange
    db.reset([rows({ "?column?": 1 })]);

    // Act
    const res = await call("post", "/employees").send(NEW_EMPLOYEE);

    // Assert
    expect(res.status).toBe(409);
  });
});
