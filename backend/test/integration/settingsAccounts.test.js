const { useTestDb, closeTestDb, seedBasics } = require("./helpers/testDb");
const terminologyRepository = require("../../src/repositories/terminology.repository");
const customFieldRepository = require("../../src/repositories/customField.repository");
const accountRepository = require("../../src/repositories/account.repository");
const assignmentRepository = require("../../src/repositories/accountAssignment.repository");
const settingsService = require("../../src/services/settings.service");
const accountService = require("../../src/services/account.service");
const assignmentService = require("../../src/services/accountAssignment.service");
const { USERS } = require("../helpers/apiHarness");

const CTX = { ipAddress: "10.0.0.1", userAgent: "integration-test" };
const PROFILE = {
  phoneNumber: null,
  email: null,
  address: null,
  city: "Pune",
  state: null,
  country: null,
  latitude: 18.5204303,
  longitude: 73.8567437,
  photoUrl: null,
  notes: null,
  extraFields: { tier: "A" },
};

let db;

function createAccount(companyId, name) {
  return accountRepository.insert(companyId, { ...PROFILE, name }, USERS.admin.id);
}

async function assignmentRows(accountId) {
  const { rows } = await db.query(
    `SELECT user_id, is_deleted FROM account_assignments
     WHERE account_id = @accountId ORDER BY id`,
    { accountId },
  );
  return rows;
}

async function activeUserIds(accountId) {
  const rows = await assignmentRows(accountId);
  return rows.filter((row) => !row.is_deleted).map((row) => row.user_id).sort();
}

beforeAll(async () => {
  db = await useTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await seedBasics();
});

describe("settings repositories on PostgreSQL", () => {
  it("upserts terminology: inserts new labels and updates the live row in place", async () => {
    // Arrange
    await terminologyRepository.upsertLabels(2, { "account.plural": "Doctors" }, 10);

    // Act
    await terminologyRepository.upsertLabels(2, {
      "account.plural": "Clinics", "account.singular": "Clinic",
    }, 10);
    const labels = await settingsService.getTerminology(2);
    const { rows } = await db.query(
      "SELECT COUNT(*) AS total FROM company_terminology WHERE company_id = 2",
    );

    // Assert
    expect(labels).toMatchObject({ "account.plural": "Clinics", "account.singular": "Clinic" });
    expect(rows[0].total).toBe(2);
    expect(await settingsService.getTerminology(1)).toMatchObject({ "account.plural": "Accounts" });
  });

  it("stores a company's own word for the field person", async () => {
    // Arrange
    const labels = { "rep.singular": "MR", "rep.plural": "MRs" };

    // Act
    await terminologyRepository.upsertLabels(2, labels, 10);

    // Assert
    expect(await settingsService.getTerminology(2)).toMatchObject(labels);
    expect(await settingsService.getTerminology(1)).toMatchObject({ "rep.plural": "Reps" });
  });

  it("stores options as jsonb and maps a duplicate field key to 409 CONFLICT", async () => {
    // Arrange
    const field = {
      entityType: "ACCOUNT",
      fieldKey: "speciality",
      label: "Speciality",
      dataType: "SELECT",
      isRequired: true,
      options: ["Cardio", "Neuro"],
      sortOrder: 1,
      isActive: true,
    };
    const created = await customFieldRepository.insert(2, field, 10);

    // Act
    const duplicate = await settingsService
      .createCustomField({ companyId: 2, userId: 10 }, field)
      .catch((err) => err);
    const listed = await settingsService.listCustomFields(2, { entityType: "ACCOUNT" });

    // Assert
    expect(duplicate).toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(created.options_json).toEqual(["Cardio", "Neuro"]);
    expect(listed).toEqual([expect.objectContaining({
      id: created.id, fieldKey: "speciality", options: ["Cardio", "Neuro"], isRequired: true,
    })]);
  });
});

describe("account repository on PostgreSQL", () => {
  it("pages accounts and limits an EMPLOYEE to the accounts assigned to them", async () => {
    // Arrange
    const ids = [
      await createAccount(2, "Alpha Clinic"),
      await createAccount(2, "Beta Clinic"),
      await createAccount(2, "Gamma 50%_off"),
    ];
    await createAccount(1, "Other company");
    await assignmentRepository.insertMany(2, [
      { accountId: ids[0], userId: 30 }, { accountId: ids[2], userId: 30 },
    ], 10);

    // Act
    const employeePage = await accountService.list(USERS.employee, {
      page: 2, pageSize: 1, search: null, isActive: null,
    });
    const managerPage = await accountService.list(USERS.manager, {
      page: 1, pageSize: 10, search: null, isActive: null,
    });
    const searched = await accountService.list(USERS.manager, {
      page: 1, pageSize: 10, search: "50%_", isActive: true,
    });

    // Assert
    expect(employeePage.total).toBe(2);
    expect(employeePage.items.map((item) => item.name)).toEqual(["Gamma 50%_off"]);
    expect(employeePage.items[0].assignedUsers).toEqual([
      { userId: 30, displayName: "Eve Employee", visitsPerMonth: null },
    ]);
    expect(managerPage.total).toBe(3);
    expect(managerPage.items.map((item) => item.id)).toEqual(ids);
    expect(managerPage.items[0]).toMatchObject({
      latitude: 18.5204303, extraFields: { tier: "A" }, isActive: true,
    });
    expect(managerPage.items[0].createdAtUtc).toMatch(/Z$/);
    expect(searched.items.map((item) => item.id)).toEqual([ids[2]]);
  });

  it("writes the old version to accounts_history when an account is updated", async () => {
    // Arrange
    const id = await createAccount(2, "Before");

    // Act
    const changed = await accountRepository.update(id, 2, { ...PROFILE, name: "After" }, 10);
    const { rows } = await db.query(
      "SELECT name, extra_fields, valid_to FROM accounts_history WHERE id = @id",
      { id },
    );

    // Assert
    expect(changed).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Before", extra_fields: { tier: "A" } });
    expect(rows[0].valid_to).toBeInstanceOf(Date);
  });
});

describe("account delete on PostgreSQL", () => {
  it("soft-deletes the account and ends its assignments in one transaction", async () => {
    // Arrange
    const accountId = await createAccount(2, "Closing");
    await assignmentRepository.insertMany(2, [{ accountId, userId: 30 }], 10);

    // Act
    await accountService.remove(USERS.admin, accountId, CTX);
    const found = await accountRepository.findById(accountId, { user: USERS.admin });

    // Assert
    expect(found).toBeNull();
    expect(await activeUserIds(accountId)).toEqual([]);
  });
});

describe("account assignments on PostgreSQL", () => {
  it("replaces the set in one transaction and can re-add a removed rep", async () => {
    // Arrange
    const accountId = await createAccount(2, "Clinic");
    await assignmentService.replace(USERS.manager, accountId, [
      { userId: 30, visitsPerMonth: 2 }, { userId: 20, visitsPerMonth: null },
    ], CTX);
    await assignmentService.replace(USERS.manager, accountId, [
      { userId: 20, visitsPerMonth: 4 },
    ], CTX);

    // Act
    const result = await assignmentService.replace(USERS.manager, accountId, [
      { userId: 20, visitsPerMonth: 4 }, { userId: 30, visitsPerMonth: 3 },
    ], CTX);

    // Assert
    expect(result.map((row) => [row.userId, row.visitsPerMonth, row.roleCode])).toEqual([
      [30, 3, "EMPLOYEE"], [20, 4, "MANAGER"],
    ]);
    expect(await assignmentRows(accountId)).toEqual([
      { user_id: 30, is_deleted: true },
      { user_id: 20, is_deleted: false },
      { user_id: 30, is_deleted: false },
    ]);
  });

  it("rolls back every change of a replace when one statement fails", async () => {
    // Arrange
    const accountId = await createAccount(2, "Clinic");
    await assignmentRepository.insertMany(2, [{ accountId, userId: 30 }], 10);

    // Act
    const run = assignmentService.replace(USERS.manager, accountId, [
      { userId: 20, visitsPerMonth: 40 },
    ], CTX);

    // Assert
    await expect(run).rejects.toMatchObject({ code: "23514" });
    expect(await activeUserIds(accountId)).toEqual([30]);
  });

  it("transfers accounts to another rep and skips the ones they already cover", async () => {
    // Arrange
    const first = await createAccount(2, "First");
    const second = await createAccount(2, "Second");
    await assignmentRepository.insertMany(2, [
      { accountId: first, userId: 30, visitsPerMonth: 5 },
      { accountId: second, userId: 30 },
      { accountId: second, userId: 20 },
    ], 10);

    // Act
    const result = await assignmentService.transfer(
      USERS.manager,
      { fromUserId: 30, toUserId: 20 },
      CTX,
    );

    // Assert
    expect(result).toEqual({ moved: 1 });
    expect(await activeUserIds(first)).toEqual([20]);
    expect(await activeUserIds(second)).toEqual([20]);
    const moved = await assignmentRepository.listByAccountIds([first]);
    expect(moved).toEqual([expect.objectContaining({ user_id: 20, visits_per_month: 5 })]);
  });
});
