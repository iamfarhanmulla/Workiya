const request = require("supertest");

jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());
jest.mock("../services/audit.service", () => ({ log: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../services/customFields.service", () => ({
  validateValues: jest.fn(async (_companyId, _entityType, values) => ({
    ok: true, value: values || {},
  })),
}));

const db = require("../config/db");
const app = require("../app");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");
const {
  ACCOUNT, activityContext, submissionRow,
} = require("../../test/helpers/fieldWorkFixtures");

// Check-in times must be recent (within the last 7 days, not in the future).
const CHECKED_IN_AT = new Date(Date.now() - 60 * 60 * 1000);
const HOUR_MS = 60 * 60 * 1000;

const CHECK_IN = {
  checkInAtUtc: CHECKED_IN_AT.toISOString(),
  checkInLatitude: ACCOUNT.lat,
  checkInLongitude: ACCOUNT.lon,
};

function activityForSubmit(overrides = {}) {
  return rows(activityContext(overrides));
}

function savedSubmission(overrides = {}) {
  return rows(submissionRow(overrides));
}

// The activity row locked by a submit, then its type rules and open submissions.
function lockedForSubmit(openSubmissions) {
  return [
    rows({
      status: "InProgress", assigned_to: USERS.employee.id, activity_type_id: 1, account_id: 3,
    }),
    activityForSubmit({ open_submissions: openSubmissions }),
  ];
}

function send(method, path, user) {
  return request(app)[method](path).set(XHR).set("Cookie", authCookie(user));
}

beforeEach(() => {
  db.reset();
});

describe("POST /api/v1/activities/:id/submissions", () => {
  it("saves the submission and completes the activity", async () => {
    // Arrange
    db.reset([
      activityForSubmit(), ...lockedForSubmit(0), rows({ id: 40 }), affected(1), savedSubmission(),
    ]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, rating: 5, answers: { met: true } });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, data: { id: 40, reviewStatus: "Pending" } });
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    expect(db.statements()[3].params).toMatchObject({ rating: 5, answers: "{\"met\":true}" });
  });

  it("returns 404 when an EMPLOYEE submits an activity that is not theirs", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send(CHECK_IN);

    // Assert
    expect(res.status).toBe(404);
    expect(db.calls[0].params).toMatchObject({ scopeUserId: USERS.employee.id });
  });

  it("returns 403 when staff submit an activity assigned to someone else", async () => {
    // Arrange
    db.reset([activityForSubmit()]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.manager)
      .send(CHECK_IN);

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 422 OUTSIDE_GEOFENCE with the distance", async () => {
    // Arrange
    db.reset([activityForSubmit()]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, checkInLongitude: ACCOUNT.lon + 0.01 });

    // Assert
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe("OUTSIDE_GEOFENCE");
    expect(res.body.message).toMatch(/\d+ m from the account/);
  });

  it("returns 409 CONFLICT for a double submit without inserting", async () => {
    // Arrange
    db.reset([activityForSubmit(), ...lockedForSubmit(1)]);

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send(CHECK_IN);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("CONFLICT");
    expect(db.statements().map((call) => call.text).join()).not.toContain("INSERT");
  });

  it("rejects unsafe URLs and unpaired coordinates", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ photoUrl: "data:text/html,x", checkInLatitude: 1 });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/photoUrl/);
    expect(res.body.message).toMatch(/checkInLongitude/);
    expect(db.calls).toHaveLength(0);
  });

  it("rejects a check-out before the check-in", async () => {
    // Arrange
    db.reset();

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
    db.reset();

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, signatureUrl: url });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch("signatureUrl: Must be an http(s) URL or a /path.");
    expect(db.calls).toHaveLength(0);
  });

  it.each([
    ["in the future", HOUR_MS, /Cannot be in the future/],
    ["older than 7 days", -8 * 24 * HOUR_MS, /Cannot be more than 7 days ago/],
  ])("rejects a check-in time %s", async (_label, offset, message) => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", "/api/v1/activities/5/submissions", USERS.employee)
      .send({ ...CHECK_IN, checkInAtUtc: new Date(Date.now() + offset).toISOString() });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
    expect(db.calls).toHaveLength(0);
  });
});

describe("submission reads and review", () => {
  it("lists only the employee's own submissions", async () => {
    // Arrange
    db.reset([rows({ total: 1 }), savedSubmission()]);

    // Act
    const res = await send("get", "/api/v1/submissions?reviewStatus=Pending", USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 1, items: [{ id: 40 }] });
    expect(db.calls[0].params).toMatchObject({
      scopeUserId: USERS.employee.id, reviewStatus: "Pending",
    });
  });

  it("returns one submission", async () => {
    // Arrange
    db.reset([savedSubmission({ answers: null })]);

    // Act
    const res = await send("get", "/api/v1/submissions/40", USERS.manager);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 40, answers: {} });
  });

  it("returns 403 when an EMPLOYEE reviews", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.employee)
      .send({ status: "Approved" });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it("lets a MANAGER reject, re-opening the activity", async () => {
    // Arrange
    db.reset([
      rows({
        company_id: 2, activity_id: 5, review_status: "Pending", activity_status: "Completed",
      }),
      affected(1),
      affected(1),
      savedSubmission({ review_status: "Rejected", review_comment: "Redo" }),
    ]);

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.manager)
      .send({ status: "Rejected", comment: "Redo" });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Submission rejected.");
    expect(res.body.data).toMatchObject({ reviewStatus: "Rejected", reviewComment: "Redo" });
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    expect(db.statements()[2].text).toContain("status = 'InProgress'");
  });

  it("returns 422 when reviewing a submission that is not Pending", async () => {
    // Arrange
    db.reset([
      rows({ company_id: 2, activity_id: 5, review_status: "Approved" }),
    ]);

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.admin)
      .send({ status: "Approved" });

    // Assert
    expect(res.status).toBe(422);
    expect(res.body.errorCode).toBe("INVALID_STATUS_TRANSITION");
  });

  it("validates the review status", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("patch", "/api/v1/submissions/40/review", USERS.admin)
      .send({ status: "Pending" });

    // Assert
    expect(res.status).toBe(400);
  });
});
