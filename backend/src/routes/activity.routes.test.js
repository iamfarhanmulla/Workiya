const request = require("supertest");

jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());
jest.mock("../services/audit.service", () => ({ log: jest.fn().mockResolvedValue(undefined) }));

const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

const NOW = new Date("2026-10-21T10:00:00.000Z");

function activityRow(overrides = {}) {
  return {
    id: 5,
    company_id: 2,
    activity_type_id: 1,
    account_id: 3,
    assigned_to: USERS.employee.id,
    assigned_by: USERS.manager.id,
    title: "Visit",
    status: "Pending",
    priority: "Medium",
    created_at: NOW,
    ...overrides,
  };
}

const NEW_ACTIVITY = {
  activityTypeId: 1, accountId: 3, assignedTo: 30, title: "Visit",
};

function send(method, path, user) {
  const req = request(app)[method](path).set(XHR);
  return user ? req.set("Cookie", authCookie(user)) : req;
}

beforeEach(() => {
  db.reset();
});

describe("activity route permissions", () => {
  it("requires a login", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("get", "/api/v1/activities");

    // Assert
    expect(res.status).toBe(401);
    expect(db.calls).toHaveLength(0);
  });

  it.each([
    ["post", "/api/v1/activities"],
    ["put", "/api/v1/activities/5"],
    ["delete", "/api/v1/activities/5"],
  ])("returns 403 when an EMPLOYEE calls %s %s", async (method, path) => {
    // Arrange
    db.reset();

    // Act
    const res = await send(method, path, USERS.employee).send(NEW_ACTIVITY);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, errorCode: "FORBIDDEN", data: null });
    expect(db.calls).toHaveLength(0);
  });

  it.each(["/api/v1/doctors", "/api/v1/tasks"])("no longer serves %s", async (path) => {
    // Arrange
    db.reset();

    // Act
    const res = await send("get", path, USERS.admin);

    // Assert
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/activities", () => {
  it("shows an EMPLOYEE only activities assigned to them, in the API wrapper", async () => {
    // Arrange
    db.reset([
      rows({ total: 1 }), rows(activityRow()),
    ]);

    // Act
    const res = await send("get", "/api/v1/activities?status=Pending&page=1", USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      errorCode: null,
      data: {
        total: 1, page: 1, pageSize: 50, items: [{ id: 5, status: "Pending" }],
      },
    });
    expect(res.body.timestamp).toEqual(expect.any(String));
    expect(db.calls[0].params).toMatchObject({
      scopeCompanyId: 2, scopeUserId: USERS.employee.id, status: "Pending",
    });
  });

  it("lets SUPER_ADMIN narrow to one company and refuses ADMIN another company", async () => {
    // Arrange
    db.reset([rows({ total: 0 }), rows()]);

    // Act
    const superRes = await send("get", "/api/v1/activities?companyId=7", USERS.superAdmin);
    const adminRes = await send("get", "/api/v1/activities?companyId=7", USERS.admin);

    // Assert
    expect(superRes.status).toBe(200);
    expect(db.calls[1].params).toEqual({ scopeCompanyId: 7, offset: 0, pageSize: 50 });
    expect(adminRes.status).toBe(403);
  });

  it("rejects bad query values with 400 VALIDATION_FAILED", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("get", "/api/v1/activities?pageSize=500", USERS.manager);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
  });

  it("turns date-only filters into whole UTC days", async () => {
    // Arrange
    db.reset([rows({ total: 0 }), rows()]);

    // Act
    const res = await send(
      "get",
      "/api/v1/activities?dateFrom=2026-10-01&dateTo=2026-10-31&search=",
      USERS.manager,
    );

    // Assert
    expect(res.status).toBe(200);
    expect(db.calls[0].params).toMatchObject({
      dateFrom: new Date("2026-10-01T00:00:00.000Z"),
      dateTo: new Date("2026-10-31T23:59:59.999Z"),
    });
    expect(db.calls[0].params).not.toHaveProperty("search");
  });

  it("returns one activity to its assignee", async () => {
    // Arrange
    db.reset([rows(activityRow())]);

    // Act
    const res = await send("get", "/api/v1/activities/5", USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 5, latestSubmission: null });
  });

  it("returns 404 for an activity that is not the employee's", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await send("get", "/api/v1/activities/5", USERS.employee);

    // Assert
    expect(res.status).toBe(404);
    expect(db.calls[0].params).toMatchObject({ id: 5, scopeUserId: USERS.employee.id });
  });
});

describe("POST /api/v1/activities", () => {
  it("uses the signed-in user as AssignedBy and their company, ignoring body values", async () => {
    // Arrange
    db.reset([
      rows({ account_ok: true, activity_type_ok: true, assignee_ok: true }),
      rows({ id: 77 }),
      rows(activityRow({ id: 77 })),
    ]);

    // Act
    const res = await send("post", "/api/v1/activities", USERS.manager)
      .send({ ...NEW_ACTIVITY, assignedBy: 999 });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(77);
    expect(db.calls[1].params).toMatchObject({
      companyId: USERS.manager.companyId, userId: USERS.manager.id, priority: "Medium",
    });
    expect(Object.values(db.calls[1].params)).not.toContain(999);
  });

  it("refuses a MANAGER creating in another company", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", "/api/v1/activities", USERS.manager)
      .send({ ...NEW_ACTIVITY, companyId: 999 });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 400 CROSS_COMPANY_REFERENCE for a foreign account or assignee", async () => {
    // Arrange
    db.reset([rows({ account_ok: false, activity_type_ok: true, assignee_ok: true })]);

    // Act
    const res = await send("post", "/api/v1/activities", USERS.admin).send(NEW_ACTIVITY);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("CROSS_COMPANY_REFERENCE");
  });

  it("validates the body", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", "/api/v1/activities", USERS.admin)
      .send({ ...NEW_ACTIVITY, title: "", priority: "Urgent" });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/title/);
    expect(res.body.message).toMatch(/priority/);
  });
});

describe("activity updates", () => {
  it("lets staff edit an activity", async () => {
    // Arrange
    db.reset([
      rows(activityRow()), affected(1), rows(activityRow({ title: "New" })),
    ]);

    // Act
    const res = await send("put", "/api/v1/activities/5", USERS.manager).send({ title: "New" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: "Activity updated.", data: { title: "New" } });
  });

  it("lets an EMPLOYEE start their own activity", async () => {
    // Arrange
    db.reset([
      rows(activityRow()), affected(1), rows(activityRow({ status: "InProgress" })),
    ]);

    // Act
    const res = await send("patch", "/api/v1/activities/5/status", USERS.employee)
      .send({ status: "InProgress" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Activity moved to InProgress.");
    expect(db.calls[1].params).toMatchObject({ fromStatus: "Pending", toStatus: "InProgress" });
  });

  it("returns 422 when an EMPLOYEE marks an activity Completed", async () => {
    // Arrange
    db.reset([rows(activityRow({ status: "InProgress" }))]);

    // Act
    const res = await send("patch", "/api/v1/activities/5/status", USERS.employee)
      .send({ status: "Completed" });

    // Assert
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe("INVALID_STATUS_TRANSITION");
  });

  it("soft deletes for staff", async () => {
    // Arrange
    db.reset([rows(activityRow()), affected(1)]);

    // Act
    const res = await send("delete", "/api/v1/activities/5", USERS.admin);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: null, message: "Activity deleted." });
    expect(db.calls[1].text).toContain("SET is_deleted = true");
  });
});
