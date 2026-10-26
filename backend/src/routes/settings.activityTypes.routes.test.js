const { Router: mockRouter } = require("express");
const request = require("supertest");

jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());
jest.mock("../services/audit.service", () => ({ log: jest.fn() }));
// Routers owned by other modules: stubbed so these tests only exercise /settings.
jest.mock("./account.routes", () => mockRouter(), { virtual: true });
jest.mock("./activity.routes", () => mockRouter(), { virtual: true });
jest.mock("./submission.routes", () => mockRouter(), { virtual: true });

const db = require("../config/db");
const app = require("../app");
const { allParams } = require("../../test/helpers/mockDb");
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

const TYPES_URL = "/api/v1/settings/activity-types";

const TYPE_ROW = {
  id: 4,
  company_id: 2,
  code: "VISIT",
  name: "Visit",
  requires_check_in: true,
  geofence_meters: 200,
  min_photos: 0,
  requires_signature: false,
  requires_customer_otp: false,
  is_active: true,
};

function send(method, url, user, body) {
  const req = request(app)[method](url).set("Cookie", authCookie(user)).set(XHR);
  return body === undefined ? req : req.send(body);
}

describe("settings routes: activity types", () => {
  beforeEach(() => {
    db.reset();
  });

  it("lists active types for an EMPLOYEE", async () => {
    // Arrange
    db.reset([rows(TYPE_ROW)]);

    // Act
    const res = await send("get", TYPES_URL, USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ id: 4, geofenceMeters: 200 })]);
    expect(db.calls[0].text).toMatch(/AND is_active/);
    expect(db.calls[0].params).toEqual({ companyId: 2 });
  });

  it("creates a type, accepting numbers sent as strings", async () => {
    // Arrange
    db.reset([rows(TYPE_ROW)]);

    // Act
    const res = await send("post", TYPES_URL, USERS.admin, {
      code: "VISIT", name: "Visit", geofenceMeters: "200",
    });

    // Assert
    expect(res.status).toBe(201);
    expect(db.calls[0].params).toMatchObject({ geofenceMeters: 200, minPhotos: 0 });
  });

  it("returns 409 CONFLICT on a duplicate code", async () => {
    // Arrange
    db.reset([Object.assign(new Error("duplicate key value"), { code: "23505" })]);

    // Act
    const res = await send("post", TYPES_URL, USERS.admin, { code: "VISIT", name: "Visit" });

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("CONFLICT");
  });

  it.each([
    [{ geofenceMeters: 5 }, "geofenceMeters"],
    [{ minPhotos: 2 }, "minPhotos"],
    [{ requiresCustomerOtp: true }, "requiresCustomerOtp"],
    [{ code: "has space" }, "code"],
    [{ name: "" }, "name"],
  ])("rejects an invalid type %p", async (overrides, path) => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", TYPES_URL, USERS.admin, {
      code: "VISIT", name: "Visit", ...overrides,
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(path);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when a MANAGER creates a type", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", TYPES_URL, USERS.manager, { code: "VISIT", name: "Visit" });

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it("updates a type", async () => {
    // Arrange
    db.reset([rows(TYPE_ROW), rows({ ...TYPE_ROW, name: "Field visit" })]);

    // Act
    const res = await send("put", `${TYPES_URL}/4`, USERS.admin, {
      code: "VISIT", name: "Field visit",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Field visit");
  });

  it("returns 409 when deleting a type used by open activities", async () => {
    // Arrange
    db.reset([rows(TYPE_ROW), rows({ total: 2 })]);

    // Act
    const res = await send("delete", `${TYPES_URL}/4`, USERS.admin);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("CONFLICT");
    expect(db.calls).toHaveLength(2);
  });

  it("soft deletes an unused type and treats a blank geofence as none", async () => {
    // Arrange
    db.reset([
      rows(TYPE_ROW),
      rows({ total: 0 }),
      affected(1),
      rows({ ...TYPE_ROW, geofence_meters: null }),
    ]);

    // Act
    const removed = await send("delete", `${TYPES_URL}/4`, USERS.admin);
    const created = await send("post", TYPES_URL, USERS.admin, {
      code: "CALL", name: "Call", geofenceMeters: "",
    });

    // Assert
    expect(removed.status).toBe(200);
    expect(removed.body.message).toBe("Activity type deleted.");
    expect(created.status).toBe(201);
    expect(created.body.data.geofenceMeters).toBeNull();
    expect(db.calls[3].params.geofenceMeters).toBeNull();
  });

  it("scopes SUPER_ADMIN deletes to the named company", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const res = await send("delete", `${TYPES_URL}/4?companyId=9`, USERS.superAdmin);

    // Assert
    expect(res.status).toBe(404);
    expect(allParams(db.calls)).toContainEqual({ name: "companyId", value: 9 });
  });
});
