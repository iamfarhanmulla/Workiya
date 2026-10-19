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

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("doctor.controller tenant scoping", () => {
  it("lists only the caller's company doctors, for any role", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 3 })]);

    // Act
    const res = await call("get", "/doctors", USERS.employee);

    // Assert
    expect(res.body.data).toEqual([{ Id: 3 }]);
    expect(db.queries[0].text).toContain("d.CompanyId = @scopeCompanyId");
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 3 })], 200],
  ])("reads one doctor within the caller's company", async (responses, status) => {
    // Arrange
    mockPool(mockConnectDb, responses);

    // Act
    const res = await call("get", "/doctors/3");

    // Assert
    expect(res.status).toBe(status);
  });

  it("files a new doctor under the MANAGER's company when none is chosen", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 4 })]);

    // Act
    const res = await call("post", "/doctors")
      .send({ name: "Dr A", companyId: "", latitude: 12.5 });

    // Assert
    expect(res.status).toBe(201);
    expect(db.queries[0].inputs).toMatchObject({
      companyId: 2, createdBy: 20, name: "Dr A", latitude: "12.5", longitude: null,
    });
  });

  it.each([
    [{ companyId: 2 }, 400],
    [{ name: "Dr A", companyId: 3 }, 403],
  ])("rejects a doctor create %p", async (body, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/doctors").send(body);

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries).toHaveLength(0);
  });

  it.each([
    [1, 200],
    [0, 404],
  ])("updates a doctor only within the caller's company "
    + "(rows affected %i)", async (count, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("put", "/doctors/3").send({ name: "Dr B" });

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries[0].text)
      .toContain("WHERE Id = @id AND IsDeleted = 0 AND CompanyId = @scopeCompanyId");
    expect(db.queries[0].inputs).toMatchObject({ companyId: 2, isActive: 1 });
  });

  it("returns 403 when a MANAGER moves a doctor to another company", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("put", "/doctors/3").send({ companyId: 3 });

    // Assert
    expect(res.status).toBe(403);
  });

  it.each([
    [{ isActive: true }, 1, "Doctor activated."],
    [{ isActive: false }, 1, "Doctor deactivated."],
    [{ isActive: false }, 0, "Doctor not found."],
  ])("toggles status %p within scope", async (body, count, message) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("patch", "/doctors/3/status").send(body);

    // Assert
    expect(res.body.message).toBe(message);
    expect(db.queries[0].text).toContain("CompanyId = @scopeCompanyId");
  });

  it("requires isActive to toggle status", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("patch", "/doctors/3/status").send({});

    // Assert
    expect(res.status).toBe(400);
  });

  it.each([
    [1, 200],
    [0, 404],
  ])("deletes a doctor only within the caller's company "
    + "(rows affected %i)", async (count, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("delete", "/doctors/3");

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries[0].text).toContain("CompanyId = @scopeCompanyId");
  });

  it("does not scope a SUPER_ADMIN by company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    await call("get", "/doctors", USERS.superAdmin);

    // Assert
    expect(db.queries[0].inputs).not.toHaveProperty("scopeCompanyId");
  });
});

describe("doctor.controller database errors", () => {
  it.each([
    ["get", "/doctors"],
    ["get", "/doctors/3"],
    ["post", "/doctors"],
    ["put", "/doctors/3"],
    ["patch", "/doctors/3/status"],
    ["delete", "/doctors/3"],
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    mockPool(mockConnectDb, [new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin).send({ name: "Dr", isActive: true });

    // Assert
    expect(res.status).toBe(500);
  });
});
