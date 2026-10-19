const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const request = require("supertest");
const app = require("../app");
const { XHR, USERS, authCookie, mockPool, rows, affected } = require("../../test/helpers/apiHarness");

function call(method, url, user = USERS.manager) {
  return request(app)[method](`/api/v1${url}`).set(XHR).set("Cookie", authCookie(user));
}

const REFS_OK = rows({ DoctorOk: 1, AssigneeOk: 1 });
const NEW_TASK = { title: "Visit", doctorId: 3, assignedTo: 30 };

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("task.controller tenant scoping", () => {
  it("lists only the caller's company tasks", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 1 })]);

    // Act
    const res = await call("get", "/tasks", USERS.employee);

    // Assert
    expect(res.body.data).toEqual([{ Id: 1 }]);
    expect(db.queries[0].text).toContain("t.CompanyId = @scopeCompanyId");
    expect(db.queries[0].inputs.scopeCompanyId).toBe(2);
  });

  it.each([
    [[rows()], 404],
    [[rows({ Id: 1 })], 200]
  ])("reads one task within the caller's company", async (responses, status) => {
    // Arrange
    mockPool(mockConnectDb, responses);

    // Act
    const res = await call("get", "/tasks/1");

    // Assert
    expect(res.status).toBe(status);
  });

  it("lets an EMPLOYEE move only a task assigned to them", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(0)]);

    // Act
    const res = await call("patch", "/tasks/99/status", USERS.employee).send({ status: "Completed" });

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[0].text).toContain("CompanyId = @scopeCompanyId AND AssignedTo = @userId");
    expect(db.queries[0].inputs).toMatchObject({ userId: USERS.employee.id, scopeCompanyId: 2 });
  });

  it("lets a MANAGER move any task of their company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    const res = await call("patch", "/tasks/5/status").send({ status: "InProgress" });

    // Assert
    expect(res.body.message).toBe("Task moved to InProgress.");
    expect(db.queries[0].text).not.toContain("@userId");
  });

  it("rejects an unknown status", async () => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("patch", "/tasks/5/status").send({ status: "Done" });

    // Assert
    expect(res.status).toBe(400);
  });

  it.each([
    [{ title: "" }, /Title/],
    [{ title: "T" }, /Doctor/],
    [{ title: "T", doctorId: 3 }, /Assignee/]
  ])("validates required task fields %p", async (body, message) => {
    // Arrange
    mockPool(mockConnectDb, []);

    // Act
    const res = await call("post", "/tasks").send(body);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it("refuses a task that points at another company's doctor or employee", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ DoctorOk: 0, AssigneeOk: 1 })]);

    // Act
    const res = await call("post", "/tasks").send(NEW_TASK);

    // Assert
    expect(res.status).toBe(400);
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].inputs).toMatchObject({ doctorId: 3, assignedTo: 30, companyId: 2 });
  });

  it("skips the reference check for a SUPER_ADMIN", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 8 })]);

    // Act
    const res = await call("post", "/tasks", USERS.superAdmin).send(NEW_TASK);

    // Assert
    expect(res.status).toBe(201);
    expect(db.queries).toHaveLength(1);
  });

  it("updates a task only within the caller's company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [REFS_OK, affected(0)]);

    // Act
    const res = await call("put", "/tasks/5").send(NEW_TASK);

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[1].text).toContain("WHERE Id = @id AND IsDeleted = 0 AND CompanyId = @scopeCompanyId");
  });

  it("updates a task in scope", async () => {
    // Arrange
    mockPool(mockConnectDb, [REFS_OK, affected(1)]);

    // Act
    const res = await call("put", "/tasks/5").send({ title: "Only title" });

    // Assert
    expect(res.body.message).toBe("Task updated.");
  });

  it("refuses an update that points at another company's employee", async () => {
    // Arrange
    mockPool(mockConnectDb, [rows({ DoctorOk: 1, AssigneeOk: 0 })]);

    // Act
    const res = await call("put", "/tasks/5").send(NEW_TASK);

    // Assert
    expect(res.status).toBe(400);
  });

  it.each([
    [1, 200],
    [0, 404]
  ])("deletes a task only within the caller's company (rows affected %i)", async (count, status) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const res = await call("delete", "/tasks/5");

    // Assert
    expect(res.status).toBe(status);
    expect(db.queries[0].text).toContain("CompanyId = @scopeCompanyId");
  });
});

describe("task.controller database errors", () => {
  it.each([
    ["get", "/tasks"],
    ["get", "/tasks/5"],
    ["post", "/tasks"],
    ["put", "/tasks/5"],
    ["patch", "/tasks/5/status"],
    ["delete", "/tasks/5"]
  ])("returns 500 for %s %s", async (method, url) => {
    // Arrange
    mockPool(mockConnectDb, [new Error("db down")]);

    // Act
    const res = await call(method, url, USERS.superAdmin).send({ ...NEW_TASK, status: "Pending" });

    // Assert
    expect(res.status).toBe(500);
  });
});
