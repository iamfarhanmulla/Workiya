const { Router: mockRouter } = require("express");
const request = require("supertest");

const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({
  sql: jest.requireActual("mssql"),
  connectDb: mockConnectDb,
}));
jest.mock("../services/audit.service", () => ({ log: jest.fn() }));
// Routers owned by other modules: stubbed so these tests only exercise /settings.
jest.mock("./account.routes", () => mockRouter(), { virtual: true });
jest.mock("./activity.routes", () => mockRouter(), { virtual: true });
jest.mock("./submission.routes", () => mockRouter(), { virtual: true });

const app = require("../app");
const { XHR, USERS, authCookie } = require("../../test/helpers/apiHarness");
const { mockTransactionalPool, allInputs } = require("../../test/helpers/transactionPool");

const FIELDS_URL = "/api/v1/settings/custom-fields";
const TYPES_URL = "/api/v1/settings/activity-types";

const FIELD_ROW = {
  Id: 5,
  CompanyId: 2,
  EntityType: "ACCOUNT",
  FieldKey: "speciality",
  Label: "Speciality",
  DataType: "SELECT",
  IsRequired: false,
  OptionsJson: JSON.stringify(["Cardio", "Neuro"]),
  SortOrder: 0,
  IsActive: true,
};

const TYPE_ROW = {
  Id: 4,
  CompanyId: 2,
  Code: "VISIT",
  Name: "Visit",
  RequiresCheckIn: true,
  GeofenceMeters: 200,
  MinPhotos: 0,
  RequiresSignature: false,
  RequiresCustomerOtp: false,
  IsActive: true,
};

const NEW_FIELD = {
  entityType: "ACCOUNT", fieldKey: "speciality", label: "Speciality", dataType: "TEXT",
};

function send(method, url, user, body) {
  const req = request(app)[method](url).set("Cookie", authCookie(user)).set(XHR);
  return body === undefined ? req : req.send(body);
}

function mockDb(responses) {
  return mockTransactionalPool(mockConnectDb, responses);
}

describe("settings routes: custom fields", () => {
  beforeEach(() => {
    mockConnectDb.mockReset();
  });

  it("lists fields for any signed-in user", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [FIELD_ROW] }]);
    const url = `${FIELDS_URL}?entityType=ACCOUNT&includeInactive=true`;

    // Act
    const res = await send("get", url, USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({
      id: 5, fieldKey: "speciality", options: ["Cardio", "Neuro"],
    })]);
    expect(db.queries[0].inputs).toMatchObject({
      companyId: 2, entityType: "ACCOUNT", includeInactive: 1,
    });
  });

  it("rejects an unknown entityType filter", async () => {
    // Arrange
    await mockDb([]);

    // Act
    const res = await send("get", `${FIELDS_URL}?entityType=DOCTOR`, USERS.admin);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
  });

  it("creates a field and returns 201 with the DTO", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [FIELD_ROW] }]);

    // Act
    const res = await send("post", FIELDS_URL, USERS.admin, {
      ...NEW_FIELD, dataType: "SELECT", options: ["Cardio", "Neuro"],
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 5, dataType: "SELECT", isRequired: false });
    expect(db.queries[0].inputs).toMatchObject({
      companyId: 2, optionsJson: "[\"Cardio\",\"Neuro\"]", userId: USERS.admin.id,
    });
  });

  it("returns 409 CONFLICT on a duplicate field key", async () => {
    // Arrange
    await mockDb([Object.assign(new Error("Cannot insert duplicate key"), { number: 2601 })]);

    // Act
    const res = await send("post", FIELDS_URL, USERS.admin, NEW_FIELD);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("CONFLICT");
  });

  it.each([
    [{ dataType: "SELECT" }, "options"],
    [{ options: ["A"] }, "options"],
    [{ options: ["A", "A"], dataType: "MULTI_SELECT" }, "options"],
    [{ fieldKey: "bad key!" }, "fieldKey"],
    [{ fieldKey: "toString" }, "fieldKey"],
    [{ fieldKey: "__proto__" }, "fieldKey"],
    [{ fieldKey: "Constructor" }, "fieldKey"],
    [{ dataType: "COLOR" }, "dataType"],
    [{ entityType: "DOCTOR" }, "entityType"],
  ])("rejects an invalid field %p", async (overrides, path) => {
    // Arrange
    const db = await mockDb([]);

    // Act
    const res = await send("post", FIELDS_URL, USERS.admin, { ...NEW_FIELD, ...overrides });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
    expect(res.body.message).toContain(path);
    expect(db.queries).toHaveLength(0);
  });

  it("returns 403 when a MANAGER creates a field", async () => {
    // Arrange
    const db = await mockDb([]);

    // Act
    const res = await send("post", FIELDS_URL, USERS.manager, NEW_FIELD);

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(0);
  });

  it("updates a field by id", async () => {
    // Arrange
    const renamed = { ...FIELD_ROW, Label: "Specialty" };
    await mockDb([{ recordset: [FIELD_ROW] }, { recordset: [renamed] }]);

    // Act
    const res = await send("put", `${FIELDS_URL}/5`, USERS.admin, {
      label: "Specialty", dataType: "SELECT",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe("Specialty");
  });

  it("refuses to change a field's data type", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [FIELD_ROW] }]);

    // Act
    const res = await send("put", `${FIELDS_URL}/5`, USERS.admin, { dataType: "TEXT" });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/dataType cannot be changed/);
    expect(db.queries).toHaveLength(1);
  });

  it("rejects a non-numeric id", async () => {
    // Arrange
    const db = await mockDb([]);

    // Act
    const res = await send("put", `${FIELDS_URL}/abc`, USERS.admin, { label: "X" });

    // Assert
    expect(res.status).toBe(400);
    expect(db.queries).toHaveLength(0);
  });

  it("soft deletes a field", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [FIELD_ROW] }, { rowsAffected: [1] }]);

    // Act
    const res = await send("delete", `${FIELDS_URL}/5`, USERS.admin);

    // Assert
    expect(res.status).toBe(200);
    expect(db.queries[1].text).toMatch(/IsDeleted = 1/);
  });
});

describe("settings routes: activity types", () => {
  beforeEach(() => {
    mockConnectDb.mockReset();
  });

  it("lists active types for an EMPLOYEE", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [TYPE_ROW] }]);

    // Act
    const res = await send("get", TYPES_URL, USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({ id: 4, geofenceMeters: 200 })]);
    expect(db.queries[0].inputs.includeInactive).toBe(0);
  });

  it("creates a type, accepting numbers sent as strings", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [TYPE_ROW] }]);

    // Act
    const res = await send("post", TYPES_URL, USERS.admin, {
      code: "VISIT", name: "Visit", geofenceMeters: "200",
    });

    // Assert
    expect(res.status).toBe(201);
    expect(db.queries[0].inputs).toMatchObject({ geofenceMeters: 200, minPhotos: 0 });
  });

  it.each([
    [{ geofenceMeters: 5 }, "geofenceMeters"],
    [{ minPhotos: 2 }, "minPhotos"],
    [{ requiresCustomerOtp: true }, "requiresCustomerOtp"],
    [{ code: "has space" }, "code"],
    [{ name: "" }, "name"],
  ])("rejects an invalid type %p", async (overrides, path) => {
    // Arrange
    const db = await mockDb([]);

    // Act
    const res = await send("post", TYPES_URL, USERS.admin, {
      code: "VISIT", name: "Visit", ...overrides,
    });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toContain(path);
    expect(db.queries).toHaveLength(0);
  });

  it("returns 403 when a MANAGER creates a type", async () => {
    // Arrange
    const db = await mockDb([]);

    // Act
    const res = await send("post", TYPES_URL, USERS.manager, { code: "VISIT", name: "Visit" });

    // Assert
    expect(res.status).toBe(403);
    expect(db.queries).toHaveLength(0);
  });

  it("updates a type", async () => {
    // Arrange
    const renamed = { ...TYPE_ROW, Name: "Field visit" };
    await mockDb([{ recordset: [TYPE_ROW] }, { recordset: [renamed] }]);

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
    const db = await mockDb([{ recordset: [TYPE_ROW] }, { recordset: [{ Total: 2 }] }]);

    // Act
    const res = await send("delete", `${TYPES_URL}/4`, USERS.admin);

    // Assert
    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe("CONFLICT");
    expect(db.queries).toHaveLength(2);
  });

  it("soft deletes an unused type and treats a blank geofence as none", async () => {
    // Arrange
    const db = await mockDb([
      { recordset: [TYPE_ROW] },
      { recordset: [{ Total: 0 }] },
      { rowsAffected: [1] },
      { recordset: [{ ...TYPE_ROW, GeofenceMeters: null }] },
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
    expect(db.queries[3].inputs.geofenceMeters).toBeNull();
  });

  it("scopes SUPER_ADMIN deletes to the named company", async () => {
    // Arrange
    const db = await mockDb([{ recordset: [] }]);

    // Act
    const res = await send("delete", `${TYPES_URL}/4?companyId=9`, USERS.superAdmin);

    // Assert
    expect(res.status).toBe(404);
    expect(allInputs(db.queries)).toContainEqual({ name: "companyId", value: 9 });
  });
});
