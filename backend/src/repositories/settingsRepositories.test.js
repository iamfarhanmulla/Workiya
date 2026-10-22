const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({
  sql: jest.requireActual("mssql"),
  connectDb: mockConnectDb,
}));

const terminologyRepository = require("./terminology.repository");
const customFieldRepository = require("./customField.repository");
const activityTypeRepository = require("./activityType.repository");
const { isUniqueViolation } = require("./sqlErrors");
const { mockTransactionalPool } = require("../../test/helpers/transactionPool");

function mockPool(responses) {
  return mockTransactionalPool(mockConnectDb, responses);
}

// Last value bound for each input name across all queries.
function inputsOf(db) {
  return Object.assign({}, ...db.queries.map((query) => query.inputs));
}

describe("terminology.repository", () => {
  it("lists live labels of one company", async () => {
    // Arrange
    const db = await mockPool([{ recordset: [{ TermKey: "account.plural", Label: "Doctors" }] }]);

    // Act
    const rows = await terminologyRepository.listByCompany(2);

    // Assert
    expect(rows).toEqual([{ TermKey: "account.plural", Label: "Doctors" }]);
    expect(inputsOf(db).companyId).toBe(2);
    expect(db.queries[0].text).toMatch(/IsDeleted = 0/);
  });

  it("upserts each label inside one committed transaction", async () => {
    // Arrange
    const db = await mockPool([]);

    // Act
    const labels = { "account.singular": "Doctor", "account.plural": "Doctors" };
    await terminologyRepository.upsertLabels(2, labels, 10);

    // Assert
    expect(db.tx).toEqual(["begin", "commit"]);
    expect(db.queries).toHaveLength(2);
    expect(db.queries[0].text).toMatch(/IF @@ROWCOUNT = 0/);
    expect(inputsOf(db)).toMatchObject({ companyId: 2, userId: 10, termKey: "account.plural" });
  });

  it("rolls back and rethrows when a statement fails", async () => {
    // Arrange
    const db = await mockPool([new Error("boom")]);

    // Act
    const promise = terminologyRepository.upsertLabels(2, { "account.plural": "Doctors" }, 10);

    // Assert
    await expect(promise).rejects.toThrow("boom");
    expect(db.tx).toEqual(["begin", "rollback"]);
  });

  it("rethrows the original error when the rollback itself fails", async () => {
    // Arrange
    await mockPool([new Error("boom")]);
    const pool = await mockConnectDb();
    const makeTransaction = pool.transaction;
    pool.transaction = () => ({
      ...makeTransaction(),
      rollback: async () => {
        throw new Error("aborted");
      },
    });

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

  it("lists with filters and defaults", async () => {
    // Arrange
    const db = await mockPool([{ recordset: [{ Id: 1 }] }, { recordset: [] }]);

    // Act
    const filters = { entityType: "ACCOUNT", includeInactive: true };
    const filtered = await customFieldRepository.list(2, filters);
    const defaults = await customFieldRepository.list(3);

    // Assert
    expect(filtered).toEqual([{ Id: 1 }]);
    expect(defaults).toEqual([]);
    expect(inputsOf(db)).toMatchObject({ companyId: 3, entityType: null, includeInactive: 0 });
    expect(db.queries[0].text).toMatch(/ORDER BY SortOrder, Label/);
  });

  it("finds one field or returns null", async () => {
    // Arrange
    await mockPool([{ recordset: [{ Id: 5 }] }, { recordset: [] }]);

    // Act
    const found = await customFieldRepository.findById(2, 5);
    const missing = await customFieldRepository.findById(2, 6);

    // Assert
    expect(found).toEqual({ Id: 5 });
    expect(missing).toBeNull();
  });

  it("inserts with audit columns and serialised options", async () => {
    // Arrange
    const db = await mockPool([{ recordset: [{ Id: 9 }] }]);

    // Act
    const row = await customFieldRepository.insert(2, FIELD, 10);

    // Assert
    expect(row).toEqual({ Id: 9 });
    expect(inputsOf(db)).toMatchObject({
      companyId: 2, optionsJson: "[\"A\",\"B\"]", isRequired: 1, isActive: 1, userId: 10,
    });
    expect(db.queries[0].text).toMatch(/GETUTCDATE\(\), @userId, GETUTCDATE\(\), @userId, 0/);
  });

  it("updates or returns null, storing null options for plain fields", async () => {
    // Arrange
    const db = await mockPool([{ recordset: [{ Id: 5 }] }, { recordset: [] }]);
    const plain = {
      ...FIELD, options: null, isRequired: false, isActive: false,
    };

    // Act
    const updated = await customFieldRepository.update(2, 5, FIELD, 10);
    const missing = await customFieldRepository.update(2, 6, plain, 10);

    // Assert
    expect(updated).toEqual({ Id: 5 });
    expect(missing).toBeNull();
    expect(inputsOf(db)).toMatchObject({ optionsJson: null, isRequired: 0, isActive: 0 });
    expect(db.queries[0].text).toMatch(/UpdatedAtUtc = GETUTCDATE\(\), UpdatedBy = @userId/);
  });

  it("soft deletes and reports whether a row changed", async () => {
    // Arrange
    const db = await mockPool([{ rowsAffected: [1] }, { rowsAffected: [0] }]);

    // Act
    const deleted = await customFieldRepository.softDelete(2, 5, 10);
    const missing = await customFieldRepository.softDelete(2, 6, 10);

    // Assert
    expect([deleted, missing]).toEqual([true, false]);
    expect(db.queries[0].text).toMatch(/IsDeleted = 1/);
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
    const db = await mockPool([{ recordset: [{ Id: 1 }] }, { recordset: [] }]);

    // Act
    const all = await activityTypeRepository.list(2, { includeInactive: true });
    const active = await activityTypeRepository.list(2);

    // Assert
    expect(all).toEqual([{ Id: 1 }]);
    expect(active).toEqual([]);
    expect(inputsOf(db).includeInactive).toBe(0);
  });

  it("finds one type or returns null", async () => {
    // Arrange
    await mockPool([{ recordset: [{ Id: 4 }] }, { recordset: [] }]);

    // Act
    const found = await activityTypeRepository.findById(2, 4);
    const missing = await activityTypeRepository.findById(2, 5);

    // Assert
    expect(found).toEqual({ Id: 4 });
    expect(missing).toBeNull();
  });

  it("inserts and updates with bound flags", async () => {
    // Arrange
    const db = await mockPool([{ recordset: [{ Id: 4 }] }, { recordset: [] }]);
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
    expect(inserted).toEqual({ Id: 4 });
    expect(updated).toBeNull();
    expect(inputsOf(db)).toMatchObject({
      requiresCheckIn: 0,
      requiresSignature: 0,
      requiresCustomerOtp: 0,
      isActive: 0,
      geofenceMeters: null,
    });
    expect(db.queries[0].text).toMatch(/OUTPUT INSERTED\.Id, INSERTED\.CompanyId/);
  });

  it("counts open activities of a type", async () => {
    // Arrange
    const db = await mockPool([{ recordset: [{ Total: 3 }] }, { recordset: [] }]);

    // Act
    const total = await activityTypeRepository.countOpenActivities(2, 4);
    const none = await activityTypeRepository.countOpenActivities(2, 5);

    // Assert
    expect([total, none]).toEqual([3, 0]);
    expect(db.queries[0].text).toMatch(/Status IN \(N'Pending', N'InProgress'\)/);
  });

  it("soft deletes and reports whether a row changed", async () => {
    // Arrange
    await mockPool([{ rowsAffected: [1] }, { rowsAffected: [0] }]);

    // Act
    const deleted = await activityTypeRepository.softDelete(2, 4, 10);
    const missing = await activityTypeRepository.softDelete(2, 5, 10);

    // Assert
    expect([deleted, missing]).toEqual([true, false]);
  });
});

describe("sqlErrors.isUniqueViolation", () => {
  it.each([
    [{ number: 2601 }, true],
    [{ number: 2627 }, true],
    [{ number: 547 }, false],
    [null, false],
  ])("isUniqueViolation(%p) is %p", (err, expected) => {
    // Arrange / Act
    const result = isUniqueViolation(err);

    // Assert
    expect(result).toBe(expected);
  });
});
