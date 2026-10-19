const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const request = require("supertest");
const app = require("../app");
const {
  XHR, USERS, authCookie, mockPool, rows, affected,
} = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.superAdmin) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("company.controller", () => {
  it("counts employees and managers by role code, not hard-coded RoleIds", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 2 })]);

    // Act
    const res = await call("get", "/companies");

    // Assert
    expect(res.body.data).toEqual([{ Id: 2 }]);
    expect(db.queries[0].text).toContain("Code = 'EMPLOYEE'");
    expect(db.queries[0].text).toContain("Code = 'MANAGER'");
    expect(db.queries[0].text).not.toMatch(/RoleId = \d/);
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 2 })], 200],
  ])("reads one company", async (responses, status) => {
    // Arrange
    mockPool(mockConnectDb, responses);

    // Act
    const res = await call("get", "/companies/2");

    // Assert
    expect(res.status).toBe(status);
  });

  it("derives a URL-safe key and creates the company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows(), rows({ Id: 5 })]);

    // Act
    const res = await call("post", "/companies").send({ name: "Acme Health, Inc." });

    // Assert
    expect(res.status).toBe(201);
    expect(db.queries[1].inputs).toMatchObject({ key: "acme-health-inc", plan: "STARTUP" });
  });

  it.each([
    [{}, [], 400],
    [{ name: "Acme" }, [rows({ Id: 1 })], 409],
  ])("rejects a company create %p", async (body, responses, status) => {
    // Arrange
    mockPool(mockConnectDb, responses);

    // Act
    const res = await call("post", "/companies").send(body);

    // Assert
    expect(res.status).toBe(status);
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 2 }), affected(1)], 200],
  ])("updates a company", async (responses, status) => {
    // Arrange
    mockPool(mockConnectDb, responses);

    // Act
    const res = await call("put", "/companies/2").send({ name: "New" });

    // Assert
    expect(res.status).toBe(status);
  });

  it.each([
    [{ isActive: true }, 200, "Company activated."],
    [{ isActive: false }, 200, "Company deactivated."],
    [{}, 400, "isActive is required."],
  ])("toggles company status %p", async (body, status, message) => {
    // Arrange
    mockPool(mockConnectDb, [affected(1)]);

    // Act
    const res = await call("patch", "/companies/2/status").send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(res.body.message).toBe(message);
  });

  it("soft-deletes a company", async () => {
    // Arrange
    mockPool(mockConnectDb, [affected(1)]);

    // Act
    const res = await call("delete", "/companies/2");

    // Assert
    expect(res.body.message).toBe("Company deleted.");
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
    mockPool(mockConnectDb, [new Error("db down")]);

    // Act
    const res = await call(method, url).send({ name: "Acme", isActive: true });

    // Assert
    expect(res.status).toBe(500);
  });
});
