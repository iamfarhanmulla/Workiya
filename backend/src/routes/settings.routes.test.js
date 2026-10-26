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
const {
  XHR, USERS, authCookie, rows, affected,
} = require("../../test/helpers/apiHarness");

const FIELDS_URL = "/api/v1/settings/custom-fields";

// options_json is jsonb: pg hands it back already parsed.
const FIELD_ROW = {
  id: 5,
  company_id: 2,
  entity_type: "ACCOUNT",
  field_key: "speciality",
  label: "Speciality",
  data_type: "SELECT",
  is_required: false,
  options_json: ["Cardio", "Neuro"],
  sort_order: 0,
  is_active: true,
};

const NEW_FIELD = {
  entityType: "ACCOUNT", fieldKey: "speciality", label: "Speciality", dataType: "TEXT",
};

function send(method, url, user, body) {
  const req = request(app)[method](url).set("Cookie", authCookie(user)).set(XHR);
  return body === undefined ? req : req.send(body);
}

describe("settings routes: custom fields", () => {
  beforeEach(() => {
    db.reset();
  });

  it("lists fields for any signed-in user", async () => {
    // Arrange
    db.reset([rows(FIELD_ROW)]);
    const url = `${FIELDS_URL}?entityType=ACCOUNT&includeInactive=true`;

    // Act
    const res = await send("get", url, USERS.employee);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([expect.objectContaining({
      id: 5, fieldKey: "speciality", options: ["Cardio", "Neuro"],
    })]);
    expect(db.calls[0].params).toEqual({ companyId: 2, entityType: "ACCOUNT" });
    expect(db.calls[0].text).not.toMatch(/AND is_active/);
  });

  it("rejects an unknown entityType filter", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("get", `${FIELDS_URL}?entityType=DOCTOR`, USERS.admin);

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
  });

  it("creates a field and returns 201 with the DTO", async () => {
    // Arrange
    db.reset([rows(FIELD_ROW)]);

    // Act
    const res = await send("post", FIELDS_URL, USERS.admin, {
      ...NEW_FIELD, dataType: "SELECT", options: ["Cardio", "Neuro"],
    });

    // Assert
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: 5, dataType: "SELECT", isRequired: false });
    expect(db.calls[0].params).toMatchObject({
      companyId: 2, optionsJson: "[\"Cardio\",\"Neuro\"]", userId: USERS.admin.id,
    });
  });

  it("returns 409 CONFLICT on a duplicate field key", async () => {
    // Arrange
    db.reset([Object.assign(new Error("duplicate key value"), { code: "23505" })]);

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
    db.reset();

    // Act
    const res = await send("post", FIELDS_URL, USERS.admin, { ...NEW_FIELD, ...overrides });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe("VALIDATION_FAILED");
    expect(res.body.message).toContain(path);
    expect(db.calls).toHaveLength(0);
  });

  it("returns 403 when a MANAGER creates a field", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("post", FIELDS_URL, USERS.manager, NEW_FIELD);

    // Assert
    expect(res.status).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it("updates a field by id", async () => {
    // Arrange
    db.reset([rows(FIELD_ROW), rows({ ...FIELD_ROW, label: "Specialty" })]);

    // Act
    const res = await send("put", `${FIELDS_URL}/5`, USERS.admin, {
      label: "Specialty", dataType: "SELECT",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe("Specialty");
    expect(db.calls[1].params).toMatchObject({ label: "Specialty", id: 5, companyId: 2 });
  });

  it("refuses to change a field's data type", async () => {
    // Arrange
    db.reset([rows(FIELD_ROW)]);

    // Act
    const res = await send("put", `${FIELDS_URL}/5`, USERS.admin, { dataType: "TEXT" });

    // Assert
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/dataType cannot be changed/);
    expect(db.calls).toHaveLength(1);
  });

  it("rejects a non-numeric id", async () => {
    // Arrange
    db.reset();

    // Act
    const res = await send("put", `${FIELDS_URL}/abc`, USERS.admin, { label: "X" });

    // Assert
    expect(res.status).toBe(400);
    expect(db.calls).toHaveLength(0);
  });

  it("soft deletes a field", async () => {
    // Arrange
    db.reset([rows(FIELD_ROW), affected(1)]);

    // Act
    const res = await send("delete", `${FIELDS_URL}/5`, USERS.admin);

    // Assert
    expect(res.status).toBe(200);
    expect(db.calls[1].text).toMatch(/is_deleted = true/);
  });
});
