const db = require("../../../src/config/db");

const SCHEMA_PATTERN = /^it_\d+_\d+$/;

// Data tables in delete order. audit_logs is append-only (TRUNCATE is rejected by a trigger),
// so tests must filter it by their own entity ids instead of clearing it.
const DATA_TABLES = Object.freeze([
  "submissions_history", "submissions",
  "activities_history", "activities",
  "account_assignments_history", "account_assignments",
  "accounts_history", "accounts",
  "activity_types", "custom_field_definitions", "company_terminology",
  "refresh_tokens", "users", "companies", "roles", "genders",
]);

function sameDatabase(a, b) {
  if (!a || !b) {
    return false;
  }
  const left = new URL(a);
  const right = new URL(b);
  return left.hostname.replace("-pooler", "") === right.hostname.replace("-pooler", "")
    && left.pathname === right.pathname;
}

// DATABASE_URL_TEST, refusing to run against the main database (DATABASE_URL / _DIRECT).
function resolveTestUrl(env = process.env) {
  const url = env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("DATABASE_URL_TEST is not set: integration tests need a separate database.");
  }
  if (sameDatabase(url, env.DATABASE_URL) || sameDatabase(url, env.DATABASE_URL_DIRECT)) {
    throw new Error("DATABASE_URL_TEST points at the main database; refusing to run.");
  }
  return url;
}

// The per-run schema created by globalSetup (TEST_SCHEMA).
function testSchema(env = process.env) {
  const schema = env.TEST_SCHEMA;
  if (!schema || !SCHEMA_PATTERN.test(schema)) {
    throw new Error("TEST_SCHEMA is not set: run integration tests with npm run test:integration.");
  }
  return schema;
}

// Points src/config/db (the module every repository uses) at the run's schema and returns it.
// Call in beforeAll; call closeTestDb() in afterAll.
async function useTestDb() {
  await db.configure({ url: resolveTestUrl(), searchPath: [testSchema(), "public"] });
  return db;
}

async function closeTestDb() {
  await db.closePool();
}

// Empties every data table (except audit_logs) and restarts their ids.
async function resetData() {
  await db.query(`TRUNCATE ${DATA_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

async function syncIdentity(table) {
  await db.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT max(id) FROM ${table}))`,
  );
}

const SEED_SQL = `
  INSERT INTO genders (id, name, code) VALUES
    (1, 'Male', 'M'), (2, 'Female', 'F'), (3, 'Other', 'O');
  INSERT INTO roles (id, name, code) VALUES
    (1, 'Super Admin', 'SUPER_ADMIN'), (2, 'Admin', 'ADMIN'),
    (3, 'Employee', 'EMPLOYEE'), (4, 'Manager', 'MANAGER');
  INSERT INTO companies (id, name, key) VALUES (1, 'Acme', 'acme'), (2, 'Globex', 'globex');
  INSERT INTO users (id, company_id, role_id, manager_id, username, first_name, last_name,
    display_name, email, password_hash) VALUES
    (1, 1, 1, NULL, 'super', 'Super', 'Admin', 'Super Admin', 'super@acme.test', 'x'),
    (10, 2, 2, NULL, 'admin', 'Ada', 'Admin', 'Ada Admin', 'admin@globex.test', 'x'),
    (20, 2, 4, NULL, 'manager', 'Max', 'Manager', 'Max Manager', 'manager@globex.test', 'x'),
    (30, 2, 3, 20, 'employee', 'Eve', 'Employee', 'Eve Employee', 'eve@globex.test', 'x'),
    (40, 1, 3, NULL, 'other', 'Otto', 'Other', 'Otto Other', 'otto@acme.test', 'x')`;

// resetData() plus reference data and users matching test/helpers/apiHarness USERS:
// company 2 holds admin 10, manager 20 and employee 30 (managed by 20); company 1 holds the
// super admin 1 and employee 40. Role ids: 1 SUPER_ADMIN, 2 ADMIN, 3 EMPLOYEE, 4 MANAGER.
async function seedBasics() {
  await resetData();
  await db.query(SEED_SQL);
  await Promise.all(["genders", "roles", "companies", "users"].map(syncIdentity));
  return {
    companyIds: { acme: 1, globex: 2 },
    userIds: {
      superAdmin: 1, admin: 10, manager: 20, employee: 30, otherCompanyEmployee: 40,
    },
    roleIds: {
      SUPER_ADMIN: 1, ADMIN: 2, EMPLOYEE: 3, MANAGER: 4,
    },
  };
}

module.exports = {
  SCHEMA_PATTERN,
  resolveTestUrl,
  testSchema,
  useTestDb,
  closeTestDb,
  resetData,
  seedBasics,
};
