const request = require("supertest");

const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({
  sql: jest.requireActual("mssql"),
  connectDb: mockConnectDb,
  getPool: mockConnectDb,
}));
jest.mock("../services/audit.service", () => ({ log: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../services/customFields.service", () => ({
  validateValues: jest.fn(async (_companyId, _entityType, values) => ({
    ok: true, value: values || {},
  })),
}));

const app = require("../app");
const {
  XHR, USERS, authCookie, mockPool, rows, affected,
} = require("../../test/helpers/apiHarness");

const NOW = new Date("2026-10-21T10:00:00.000Z");
const ACCOUNT = { lat: 19.076, lon: 72.8777 };

// Check-in times must be recent (within the last 7 days, not in the future).
const CHECKED_IN_AT = new Date(Date.now() - 60 * 60 * 1000);
const HOUR_MS = 60 * 60 * 1000;

const CHECK_IN = {
  checkInAtUtc: CHECKED_IN_AT.toISOString(),
  checkInLatitude: ACCOUNT.lat,
  checkInLongitude: ACCOUNT.lon,
};

function activityForSubmit(overrides = {}) {
  return rows({
    Id: 5,
    CompanyId: 2,
    AssignedTo: USERS.employee.id,
    Status: "InProgress",
    RequiresCheckIn: true,
    GeofenceMeters: 100,
    MinPhotos: 0,
    RequiresSignature: false,
    AccountLatitude: ACCOUNT.lat,
    AccountLongitude: ACCOUNT.lon,
    ...overrides,
  });
}

function submissionRow(overrides = {}) {
  return rows({
    Id: 40,
    CompanyId: 2,
    ActivityId: 5,
    SubmittedBy: USERS.employee.id,
    ReviewStatus: "Pending",
    SubmittedAtUtc: NOW,
    ...overrides,
  });
}

// Adds pool.transaction() to the fake pool; its requests share the pool's response queue.
async function withTransaction(db) {
  const pool = await mockConnectDb();
  const transaction = {
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    request: () => pool.request(),
  };
  pool.transaction = () => transaction;
  return { ...db, transaction };
}

function send(method, path, user) {
  return request(app)[method](path).set(XHR).set("Cookie", authCookie(user));
}

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("POST /api/v1/activities/:id/submissions", () => {
  it("saves the submission and completes the activity", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [
      activityForSubmit(),
      rows({ Status: "InProgress", AssignedTo: USERS.employee.id, OpenSubmissions: 0 }),
      rows({ Id: 40 }),
      submissionRow(),
    ]));

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, rating: 5, answers: { met: true } });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { id: 40, reviewStatus: "Pending" } });
    expect(db.transaction.commit).toHaveBeenCalled();
    expect(db.queries[2].inputs).toMatchObject({ rating: 5, answers: "{\"met\":true}" });
  });

  it("returns 404 when an EMPLOYEE submits an activity that is not theirs", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send(CHECK_IN);

    // Assert
    expect(res.status).toBe(404);
    expect(db.queries[0].inputs).toMatchObject({ scopeUserId: USERS.employee.id });
  });

  it("returns 403 when staff submit an activity assigned to someone else", async () => {
    // Arrange
    mockPool(mockConnectDb, [activityForSubmit()]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.manager)
      .send(CHECK_IN);

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 422 OUTSIDE_GEOFENCE with the distance", async () => {
    // Arrange
    mockPool(mockConnectDb, [activityForSubmit()]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, checkInLongitude: ACCOUNT.lon + 0.01 });

    // Assert
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe("OUTSIDE_GEOFENCE");
    expect(res.body.message).toMatch(/\d+ m from the account/);
  });

  it("returns 409 CONFLICT for a double submit and rolls back", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [
      activityForSubmit(),
      rows({ Status: "InProgress", AssignedTo: USERS.employee.id, OpenSubmissions: 1 }),
    ]));

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send(CHECK_IN);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("CONFLICT");
    expect(db.transaction.rollback).toHaveBeenCalled();
  });

  it("rejects unsafe URLs and unpaired coordinates", async () => {
    // Arrange
    const db = mockPool(mockConnectDb);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ photoUrl: "data:text/html,x", checkInLatitude: 1 });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/photoUrl/);
    expect(res.body.message).toMatch(/checkInLongitude/);
    expect(db.queries).toHaveLength(0);
  });

  it("rejects a check-out before the check-in", async () => {
    // Arrange
    mockPool(mockConnectDb);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({
        ...CHECK_IN, checkOutAtUtc: new Date(CHECKED_IN_AT.getTime() - HOUR_MS).toISOString(),
      });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/checkOutAtUtc: Check-out cannot be before check-in/);
  });
});

describe("submission body checks", () => {
  it.each([
    ["//evil.example/login"],
    ["/\\evil.example"],
    ["javascript:alert(1)"], // eslint-disable-line no-script-url -- the unsafe input under test
    ["https:///evil.example"],
  ])("rejects the off-site or unsafe URL %p", async (url) => {
    // Arrange
    const db = mockPool(mockConnectDb);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, signatureUrl: url });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch("signatureUrl: Must be an http(s) URL or a /path.");
    expect(db.queries).toHaveLength(0);
  });

  it.each([
    ["in the future", HOUR_MS, /Cannot be in the future/],
    ["older than 7 days", -8 * 24 * HOUR_MS, /Cannot be more than 7 days ago/],
  ])("rejects a check-in time %s", async (_label, offset, message) => {
    // Arrange
    const db = mockPool(mockConnectDb);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, checkInAtUtc: new Date(Date.now() + offset).toISOString() });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(db.queries).toHaveLength(0);
  });
});

describe("submission reads and review", () => {
  it("lists only the employee's own submissions", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [
      { recordsets: [[{ Total: 1 }], submissionRow().recordset] },
    ]);

    // Act
    const res = await send("get", "/api/v1/submissions?reviewStatus=Pending", USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, items: [{ id: 40 }] });
    expect(db.queries[0].inputs).toMatchObject({
      scopeUserId: USERS.employee.id, reviewStatus: "Pending",
    });
  });

  it("returns one submission", async () => {
    // Arrange
    mockPool(mockConnectDb, [submissionRow()]);

    // Act
    const res = await send("get", "/api/v1/submissions/40", USERS.manager);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 40, answers: {} });
  });

  it("returns 403 when an EMPLOYEE reviews", async () => {
    // Arrange
    const db = mockPool(mockConnectDb);

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.employee)
      .send({ status: "Approved" });

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(0);
  });

  it("lets a MANAGER reject, re-opening the activity", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [
      rows({
        CompanyId: 2, ActivityId: 5, ReviewStatus: "Pending", ActivityStatus: "Completed",
      }),
      affected(1),
      submissionRow({ ReviewStatus: "Rejected", ReviewComment: "Redo" }),
    ]));

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.manager)
      .send({ status: "Rejected", comment: "Redo" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Submission rejected.");
    expect(res.body.data).toMatchObject({ reviewStatus: "Rejected", reviewComment: "Redo" });
    expect(db.transaction.commit).toHaveBeenCalled();
  });

  it("returns 422 when reviewing a submission that is not Pending", async () => {
    // Arrange
    await withTransaction(mockPool(mockConnectDb, [
      rows({ CompanyId: 2, ActivityId: 5, ReviewStatus: "Approved" }),
    ]));

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.admin)
      .send({ status: "Approved" });

    // Assert
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe("INVALID_STATUS_TRANSITION");
  });

  it("validates the review status", async () => {
    // Arrange
    mockPool(mockConnectDb);

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.admin)
      .send({ status: "Pending" });

    // Assert
    expect(res.status).toBe(400);
  });
});
