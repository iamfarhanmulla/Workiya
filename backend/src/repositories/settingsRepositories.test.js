jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const terminologyRepository = require("./terminology.repository");
const customFieldRepository = require("./customField.repository");
const activityTypeRepository = require("./activityType.repository");
const { isUniqueViolation } = require("./sqlErrors");
const { rows, affected } = require("../../test/helpers/mockDb");

beforeEach(() => {
  db.reset();
});

describe("terminology.repository", () => {
  it("lists live labels of one company", async () => {
    // Arrange
    db.reset([rows({ term_key: "account.plural", label: "Doctors" })]);

    // Act
    const result = await terminologyRepository.listByCompany(2);

    // Assert
    expect(result).toEqual([{ term_key: "account.plural", label: "Doctors" }]);
    expect(db.calls[0].params).toEqual({ companyId: 2 });
    expect(db.calls[0].text).toMatch(/NOT is_deleted/);
  });

  it("upserts every label in one statement against the live-row unique index", async () => {
    // Arrange
    const labels = { "account.singular": "Doctor", "account.plural": "Doctors" };

    // Act
    await terminologyRepository.upsertLabels(2, labels, 10);

    // Assert
    expect(db.calls).toHaveLength(1);
    const { text, params } = db.calls[0];
    expect(text).toContain("ON CONFLICT (company_id, term_key) WHERE NOT is_deleted");
    expect(text).toContain("unnest(@termKeys::varchar[], @labels::varchar[])");
    expect(params).toEqual({
      companyId: 2,
      userId: 10,
      termKeys: ["account.singular", "account.plural"],
      labels: ["Doctor", "Doctors"],
    });
  });

  it("skips the database when there is nothing to save", async () => {
    // Arrange / Act
    await terminologyRepository.upsertLabels(2, {}, 10);

    // Assert
    expect(db.calls).toHaveLength(0);
  });

  it("rethrows a failed upsert", async () => {
    // Arrange
    db.reset([new Error("boom")]);

    // Act
    const promise = terminologyRepository.upsertLabels(2, { "account.plural": "Doctors" }, 10);

    // Assert
    await expect(promise).rejects.toThrow("boom");
  });
});

describe("customField.repository", () => {
  const FIELD = {
    entityType: "ACCOUNT",
    fieldKey: "speciality",
    label: "Speciality",
    dataType: "SELECT",
    isRequired: true,
    options: ["A", "B"],
    sortOrder: 2,
    isActive: true,
  };

  it("filters by entity type and includes inactive fields when asked", async () => {
    // Arrange
    db.reset([rows({ id: 1 })]);

    // Act
    const result = await customFieldRepository.list(2, {
      entityType: "ACCOUNT", includeInactive: true,
    });

    // Assert
    expect(result).toEqual([{ id: 1 }]);
    const { text, params } = db.calls[0];
    expect(params).toEqual({ companyId: 2, entityType: "ACCOUNT" });
    expect(text).toContain("entity_type = @entityType");
    expect(text).not.toMatch(/AND is_active/);
    expect(text).toMatch(/ORDER BY sort_order, label, id/);
  });

  it("lists only active fields of every entity type by default", async () => {
    // Arrange / Act
    const result = await customFieldRepository.list(3);

    // Assert
    expect(result).toEqual([]);
    const { text, params } = db.calls[0];
    expect(params).toEqual({ companyId: 3 });
    expect(text).not.toContain("@entityType");
    expect(text).toMatch(/AND is_active/);
  });

  it("finds one field or returns null", async () => {
    // Arrange
    db.reset([rows({ id: 5 }), rows()]);

    // Act
    const found = await customFieldRepository.findById(2, 5);
    const missing = await customFieldRepository.findById(2, 6);

    // Assert
    expect(found).toEqual({ id: 5 });
    expect(missing).toBeNull();
    expect(db.calls[0].params).toEqual({ companyId: 2, id: 5 });
  });

  it("inserts with audit columns and options as jsonb text", async () => {
    // Arrange
    db.reset([rows({ id: 9 })]);

    // Act
    const row = await customFieldRepository.insert(2, FIELD, 10);

    // Assert
    expect(row).toEqual({ id: 9 });
    const { text, params } = db.calls[0];
    expect(text).toContain("@optionsJson::jsonb");
    expect(text).toMatch(/RETURNING id, company_id/);
    expect(params).toMatchObject({
      companyId: 2,
      fieldKey: "speciality",
      optionsJson: "[\"A\",\"B\"]",
      isRequired: true,
      isActive: true,
      userId: 10,
    });
  });

  it("updates or returns null, storing null options for plain fields", async () => {
    // Arrange
    db.reset([rows({ id: 5 }), rows()]);
    const plain = {
      ...FIELD, options: null, isRequired: false, isActive: false,
    };

    // Act
    const updated = await customFieldRepository.update(2, 5, FIELD, 10);
    const missing = await customFieldRepository.update(2, 6, plain, 10);

    // Assert
    expect(updated).toEqual({ id: 5 });
    expect(missing).toBeNull();
    expect(db.calls[1].params).toMatchObject({
      optionsJson: null, isRequired: false, isActive: false,
    });
    expect(db.calls[0].text).toMatch(/updated_at = now\(\), updated_by = @userId/);
  });

  it("soft deletes and reports whether a row changed", async () => {
    // Arrange
    db.reset([affected(1), affected(0)]);

    // Act
    const deleted = await customFieldRepository.softDelete(2, 5, 10);
    const missing = await customFieldRepository.softDelete(2, 6, 10);

    // Assert
    expect([deleted, missing]).toEqual([true, false]);
    expect(db.calls[0].text).toMatch(/is_deleted = true, is_active = false/);
  });
});

describe("activityType.repository", () => {
  const TYPE = {
    code: "VISIT",
    name: "Visit",
    requiresCheckIn: true,
    geofenceMeters: 100,
    minPhotos: 1,
    requiresSignature: true,
    requiresCustomerOtp: true,
    isActive: true,
  };

  it("lists active types by default and all when asked", async () => {
    // Arrange
    db.reset([rows({ id: 1 }), rows()]);

    // Act
    const all = await activityTypeRepository.list(2, { includeInactive: true });
    const active = await activityTypeRepository.list(2);

    // Assert
    expect(all).toEqual([{ id: 1 }]);
    expect(active).toEqual([]);
    expect(db.calls[0].text).not.toMatch(/AND is_active/);
    expect(db.calls[1].text).toMatch(/AND is_active/);
  });

  it("finds one type or returns null", async () => {
    // Arrange
    db.reset([rows({ id: 4 }), rows()]);

    // Act
    const found = await activityTypeRepository.findById(2, 4);
    const missing = await activityTypeRepository.findById(2, 5);

    // Assert
    expect(found).toEqual({ id: 4 });
    expect(missing).toBeNull();
  });

  it("inserts and updates with bound flags", async () => {
    // Arrange
    db.reset([rows({ id: 4 }), rows()]);
    const flagsOff = {
      ...TYPE,
      requiresCheckIn: false,
      requiresSignature: false,
      requiresCustomerOtp: false,
      isActive: false,
      geofenceMeters: undefined,
    };

    // Act
    const inserted = await activityTypeRepository.insert(2, TYPE, 10);
    const updated = await activityTypeRepository.update(2, 4, flagsOff, 10);

    // Assert
    expect(inserted).toEqual({ id: 4 });
    expect(updated).toBeNull();
    expect(db.calls[0].text).toMatch(/RETURNING id, company_id, code/);
    expect(db.calls[0].params).toMatchObject({ companyId: 2, userId: 10, geofenceMeters: 100 });
    expect(db.calls[1].params).toMatchObject({
      id: 4,
      requiresCheckIn: false,
      requiresSignature: false,
      requiresCustomerOtp: false,
      isActive: false,
      geofenceMeters: null,
    });
  });

  it("counts open activities of a type", async () => {
    // Arrange
    db.reset([rows({ total: 3 }), rows()]);

    // Act
    const total = await activityTypeRepository.countOpenActivities(2, 4);
    const none = await activityTypeRepository.countOpenActivities(2, 5);

    // Assert
    expect([total, none]).toEqual([3, 0]);
    expect(db.calls[0].text).toMatch(/status IN \('Pending', 'InProgress'\)/);
  });

  it("soft deletes and reports whether a row changed", async () => {
    // Arrange
    db.reset([affected(1), affected(0)]);

    // Act
    const deleted = await activityTypeRepository.softDelete(2, 4, 10);
    const missing = await activityTypeRepository.softDelete(2, 5, 10);

    // Assert
    expect([deleted, missing]).toEqual([true, false]);
  });
});

describe("sqlErrors", () => {
  it.each([
    [{ code: "23505" }, true],
    [{ code: "23503" }, false],
    [{ number: 2601 }, false],
    [null, false],
  ])("isUniqueViolation(%p) is %p", (err, expected) => {
    // Arrange / Act
    const result = isUniqueViolation(err);

    // Assert
    expect(result).toBe(expected);
  });
});
