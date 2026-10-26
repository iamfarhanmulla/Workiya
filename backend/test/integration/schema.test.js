const fs = require("node:fs");
const path = require("node:path");
const {
  extractSection, listMigrationFiles, MIGRATIONS_DIR,
} = require("../../scripts/run-pg-migration");
const {
  useTestDb, closeTestDb, seedBasics, testSchema,
} = require("./helpers/testDb");

const EXPECTED_TABLES = [
  "account_assignments", "account_assignments_history", "accounts", "accounts_history",
  "activities", "activities_history", "activity_types", "audit_logs", "companies",
  "company_terminology", "custom_field_definitions", "genders", "refresh_tokens", "roles",
  "schema_migrations", "submissions", "submissions_history", "users",
];

let db;

async function insertAccount(companyId, name) {
  const { rows } = await db.query(
    "INSERT INTO accounts (company_id, name, extra_fields, latitude)"
    + " VALUES (@companyId, @name, @extra, @latitude) RETURNING *",
    {
      companyId, name, extra: { tier: "A" }, latitude: 12.3456789,
    },
  );
  return rows[0];
}

async function insertActivityType(companyId) {
  const { rows } = await db.query(
    "INSERT INTO activity_types (company_id, code, name) VALUES (@companyId, 'VISIT', 'Visit')"
    + " RETURNING id",
    { companyId },
  );
  return rows[0].id;
}

async function insertAuditLog() {
  await db.query(
    "INSERT INTO audit_logs (event_type, entity_type, entity_id, new_value)"
    + " VALUES ('TEST', 'schema-test', @entityId, @newValue)",
    { entityId: "1", newValue: { ok: true } },
  );
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

describe("PostgreSQL schema", () => {
  it("creates every table in the run's schema and records the migrations", async () => {
    // Arrange
    const schema = testSchema();

    // Act
    const tables = await db.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = @schema"
      + " ORDER BY table_name",
      { schema },
    );
    const migrations = await db.query("SELECT file_name FROM schema_migrations");

    // Assert
    expect(tables.rows.map((row) => row.table_name)).toEqual(EXPECTED_TABLES);
    expect(migrations.rowCount).toBeGreaterThanOrEqual(3);
  });

  it("returns jsonb as objects, numeric as numbers and timestamptz as dates", async () => {
    // Arrange / Act
    const account = await insertAccount(2, "Clinic");

    // Assert
    expect(account.extra_fields).toEqual({ tier: "A" });
    expect(account.latitude).toBe(12.3456789);
    expect(account.created_at).toBeInstanceOf(Date);
    expect(account.is_deleted).toBe(false);
  });

  it("matches user emails case-insensitively (citext)", async () => {
    // Arrange / Act
    const { rows } = await db.query(
      "SELECT id FROM users WHERE email = @email",
      { email: "EVE@Globex.Test" },
    );

    // Assert
    expect(rows).toEqual([{ id: 30 }]);
  });

  it("keeps the old version of an account in accounts_history on UPDATE", async () => {
    // Arrange
    const account = await insertAccount(2, "Before");

    // Act
    await db.query("UPDATE accounts SET name = 'After' WHERE id = @id", { id: account.id });
    const history = await db.query(
      "SELECT name, valid_from, valid_to FROM accounts_history WHERE id = @id",
      { id: account.id },
    );
    const current = await db.query("SELECT name FROM accounts WHERE id = @id", { id: account.id });

    // Assert
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].name).toBe("Before");
    expect(history.rows[0].valid_to.getTime())
      .toBeGreaterThanOrEqual(history.rows[0].valid_from.getTime());
    expect(current.rows[0].name).toBe("After");
  });

  it.each([
    ["UPDATE", "UPDATE audit_logs SET event_type = 'CHANGED'"],
    ["DELETE", "DELETE FROM audit_logs"],
    ["TRUNCATE", "TRUNCATE audit_logs"],
  ])("rejects %s on audit_logs", async (operation, statement) => {
    // Arrange
    await insertAuditLog();

    // Act
    const run = db.query(statement);

    // Assert
    await expect(run).rejects.toThrow(`audit_logs is append-only: ${operation} is not allowed.`);
  });

  it("rejects a second active custom field with the same key (23505)", async () => {
    // Arrange
    const insert = "INSERT INTO custom_field_definitions"
      + " (company_id, entity_type, field_key, label, data_type, options_json)"
      + " VALUES (2, 'ACCOUNT', 'tier', 'Tier', 'SELECT', @options)";
    await db.query(insert, { options: JSON.stringify(["A", "B"]) });

    // Act
    const error = await db.query(insert, { options: null }).catch((err) => err);

    // Assert
    expect(error).toMatchObject({ code: "23505" });
    expect(db.isUniqueViolation(error)).toBe(true);
  });

  it("refuses an activity that points at another company's account (23503)", async () => {
    // Arrange
    const otherCompanyAccount = await insertAccount(1, "Acme clinic");
    const activityTypeId = await insertActivityType(2);

    // Act
    const insert = db.query(
      "INSERT INTO activities (company_id, activity_type_id, account_id, assigned_to,"
      + " assigned_by, title) VALUES (2, @typeId, @accountId, 30, 10, 'Visit')",
      { typeId: activityTypeId, accountId: otherCompanyAccount.id },
    );

    // Assert
    await expect(insert).rejects.toMatchObject({ code: "23503" });
  });

  it("refuses an activity assigned to a user of another company (23503)", async () => {
    // Arrange
    const account = await insertAccount(2, "Globex clinic");
    const activityTypeId = await insertActivityType(2);

    // Act
    const insert = db.query(
      "INSERT INTO activities (company_id, activity_type_id, account_id, assigned_to,"
      + " assigned_by, title) VALUES (2, @typeId, @accountId, 40, 10, 'Visit')",
      { typeId: activityTypeId, accountId: account.id },
    );

    // Assert
    await expect(insert).rejects.toMatchObject({
      code: "23503", constraint: "fk_activities_assigned_to",
    });
  });

  it("commits and rolls back through withTransaction", async () => {
    // Arrange
    const failure = new Error("stop");

    // Act
    await db.withTransaction((tx) => tx.query(
      "INSERT INTO company_terminology (company_id, term_key, label)"
      + " VALUES (2, 'account.singular', 'Store')",
    ));
    const rolledBack = db.withTransaction(async (tx) => {
      await tx.query(
        "INSERT INTO company_terminology (company_id, term_key, label)"
        + " VALUES (2, 'account.plural', 'Stores')",
      );
      throw failure;
    });
    await expect(rolledBack).rejects.toBe(failure);
    const { rows } = await db.query(
      "SELECT term_key FROM company_terminology WHERE company_id = 2 ORDER BY term_key",
    );

    // Assert
    expect(rows).toEqual([{ term_key: "account.singular" }]);
  });

  it("reverts every migration with its DOWN section (in a rolled-back transaction)", async () => {
    // Arrange
    const downSections = listMigrationFiles().reverse().map((name) => extractSection(
      // eslint-disable-next-line n/no-sync -- test reads the migration files once
      fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"),
      "down",
    ));
    const undo = new Error("undo");
    let remaining;

    // Act
    const run = db.withTransaction(async (tx) => {
      // eslint-disable-next-line no-restricted-syntax -- DOWN sections run in reverse order
      for (const section of downSections) {
        // eslint-disable-next-line no-await-in-loop -- each revert depends on the previous one
        await tx.query(section);
      }
      remaining = await tx.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = @schema",
        { schema: testSchema() },
      );
      throw undo;
    });

    // Assert
    await expect(run).rejects.toBe(undo);
    expect(remaining.rows.map((row) => row.table_name)).toEqual(["schema_migrations"]);
  });
});
