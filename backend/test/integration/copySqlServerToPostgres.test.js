// Runs the SQL Server -> PostgreSQL copy (scripts/copy-sqlserver-to-postgres.js) against a real
// PostgreSQL schema of its own, with an in-memory SQL Server source shaped like the mssql driver
// output. The schema is created, migrated and dropped by this file.
const { escapeIdentifier } = require("pg");
const { createPool } = require("../../src/config/db");
const { migrateUp } = require("../../scripts/run-pg-migration");
const {
  main, openPostgres, copyInTransaction,
} = require("../../scripts/copy-sqlserver-to-postgres");
const { TABLES } = require("../../scripts/lib/copyMappings");
const { buildPlan } = require("../../scripts/lib/copyRows");
const { resolveTestUrl, testSchema } = require("./helpers/testDb");
const {
  T0, T1, T2, fakeSource,
} = require("./helpers/copySource");

let schema;
let pool;

async function runCopy(...flags) {
  const output = [];
  const code = await main(["node", "copy", "--target-env", "DATABASE_URL_TEST", "--schema",
    schema, "--yes", ...flags], {
    env: { DATABASE_URL_TEST: resolveTestUrl() },
    out: (text) => output.push(text),
    openSource: fakeSource,
    openTarget: openPostgres,
  });
  return { code, output: output.join("") };
}

async function select(text) {
  return (await pool.query(text)).rows;
}

beforeAll(async () => {
  const stamp = Date.now();
  schema = `it_${stamp}_${process.pid}` === testSchema() ? `it_${stamp + 1}_${process.pid}`
    : `it_${stamp}_${process.pid}`;
  pool = createPool({ url: resolveTestUrl(), searchPath: [schema, "public"], max: 1 });
  await pool.query(`CREATE SCHEMA ${escapeIdentifier(schema)}`);
  const client = await pool.connect();
  try {
    await migrateUp(client);
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${escapeIdentifier(schema)} CASCADE`);
  await pool.end();
});

describe("copy-sqlserver-to-postgres against PostgreSQL", () => {
  it("copies, keeps ids and values, skips invalid rows, verifies and commits", async () => {
    // Arrange / Act
    const result = await runCopy();

    // Assert
    expect(result.code).toBe(0);
    expect(result.output).toContain("Copy committed.");
    expect(result.output).not.toMatch(/MISMATCH/);
    expect(result.output).toContain("4 row(s) break the PostgreSQL same-company rules");
    expect(result.output).toContain("skipped: activities id 1: assigned_to user 19 belongs to"
      + " company 1, not 2");
    expect(result.output).toContain("skipped: submissions id 6: activity_id 1 is not copied");
    expect(result.output).toContain(`skipped: activities_history id 1 (version until ${
      T1.toISOString()}): activities id 1 is not copied`);
    expect(result.output).toContain(`skipped: submissions_history id 6 (version until ${
      T1.toISOString()}): submissions id 6 is not copied`);
    expect(result.output).toMatch(/activities\s+2\s+1\s+1\s+1\s+1\s+OK/);
    expect(await select("SELECT id, manager_id FROM users ORDER BY id")).toEqual([
      { id: 1, manager_id: null }, { id: 19, manager_id: 20 }, { id: 20, manager_id: null },
      { id: 30, manager_id: null },
    ]);
    expect(await select("SELECT id FROM activities")).toEqual([{ id: 2 }]);
    expect(await select("SELECT id FROM submissions")).toEqual([{ id: 5 }]);
    expect(await select("SELECT id, valid_from, valid_to FROM activities_history")).toEqual([
      { id: 2, valid_from: T1, valid_to: T2 },
    ]);
    expect(await select("SELECT id FROM submissions_history")).toEqual([{ id: 5 }]);
  });

  it("stores jsonb, numeric, citext and timestamptz values", async () => {
    // Arrange / Act
    const [field] = await select("SELECT options_json FROM custom_field_definitions");
    const [account] = await select("SELECT extra_fields, latitude, valid_from FROM accounts");
    const [audit] = await select("SELECT id, old_value, new_value FROM audit_logs");
    const byEmail = await select("SELECT id FROM users WHERE email = 'user19@example.TEST'");
    const [company] = await select("SELECT created_by, updated_at FROM companies WHERE id = 1");
    const [role] = await select("SELECT updated_at FROM roles WHERE id = 1");

    // Assert
    expect(field.options_json).toEqual(["A", "B"]);
    expect(account).toEqual({
      extra_fields: { specialization: "Cardiologist" }, latitude: 19.0760123, valid_from: T1,
    });
    expect(audit).toEqual({ id: 7, old_value: "not json", new_value: { rememberMe: false } });
    expect(byEmail).toEqual([{ id: 19 }]);
    expect(company).toEqual({ created_by: null, updated_at: T1 });
    expect(role.updated_at).toEqual(T0);
  });

  it("moves identity sequences past the copied ids and re-enables triggers", async () => {
    // Arrange
    const insert = "INSERT INTO audit_logs (event_type, entity_type) VALUES ('X', 'Y')"
      + " RETURNING id";

    // Act
    const [{ id }] = await select(insert);
    await pool.query("UPDATE accounts SET name = 'Renamed' WHERE id = 1");
    const history = await select("SELECT name FROM accounts_history");
    const update = pool.query("UPDATE audit_logs SET event_type = 'Z'");

    // Assert
    expect(id).toBe(8);
    expect(history).toEqual([{ name: "Dr. Mehta" }]);
    await expect(update).rejects.toThrow("audit_logs is append-only");
  });

  it("refuses a filled target, then replaces it with --reset", async () => {
    // Arrange
    const refused = runCopy();
    await expect(refused).rejects.toThrow("Target tables already hold rows");

    // Act
    const result = await runCopy("--reset");

    // Assert
    expect(result.code).toBe(0);
    expect(result.output).toContain("--reset");
    expect(await select("SELECT id FROM audit_logs")).toEqual([{ id: 7 }]);
    expect(await select("SELECT count(*)::int AS n FROM accounts_history")).toEqual([{ n: 0 }]);
    expect(await select("SELECT name FROM accounts")).toEqual([{ name: "Dr. Mehta" }]);
  });

  it("rolls back everything when the database rejects a row", async () => {
    // Arrange
    const source = await fakeSource();
    const plan = await buildPlan(TABLES, (spec) => source.readRows(spec));
    const activities = plan.find((entry) => entry.spec.target === "activities");
    activities.rows.push(...activities.rejected.map(({ id }) => ({
      ...activities.rows[0], id, assigned_to: 19,
    })));
    const { client, close } = await openPostgres(resolveTestUrl(), schema);

    // Act
    const act = copyInTransaction(client, plan, { reset: true, out: () => {} });

    // Assert
    await expect(act).rejects.toMatchObject({ code: "23503" });
    await close();
    expect(await select("SELECT id FROM activities")).toEqual([{ id: 2 }]);
    expect(await select("SELECT tgenabled FROM pg_trigger WHERE tgname ="
      + " 'trg_audit_logs_reject_truncate' AND tgrelid = 'audit_logs'::regclass"))
      .toEqual([{ tgenabled: "O" }]);
  });
});
