const { useTestDb, closeTestDb, seedBasics } = require("./helpers/testDb");
const { runCompany } = require("../../scripts/seed-demo-reports");
const reportService = require("../../src/services/report.service");
const { USERS } = require("../helpers/apiHarness");

let db;
const out = jest.fn();

beforeAll(async () => {
  db = await useTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  out.mockClear();
  await seedBasics();
  await db.query(`INSERT INTO activity_types (company_id, code, name)
    VALUES (2, 'DOCTOR_VISIT', 'Doctor Visit')`);
});

async function count(sql) {
  const { rows } = await db.query(sql);
  return rows[0].total;
}

describe("seed-demo-reports", () => {
  it("dry run writes nothing", async () => {
    // Act
    await runCompany(db, 2, 0, { confirmed: false, remove: false, out });

    // Assert
    expect(out.mock.calls[0][0]).toMatch(/would add 3 reps, 8 doctors/);
    expect(await count("SELECT count(*) AS total FROM accounts")).toBe(0);
  });

  it("seeds data the coverage report shows, skips a second run and removes it all", async () => {
    // Act
    await runCompany(db, 2, 0, { confirmed: true, remove: false, out });
    await runCompany(db, 2, 0, { confirmed: true, remove: false, out });
    const report = await reportService.coverage(USERS.admin, {});

    // Assert
    expect(out.mock.calls[1][0]).toMatch(/already has demo data/);
    expect(report.byRep).toHaveLength(3);
    expect(report.totals.target).toBeGreaterThan(0);
    expect(report.totals.completed + report.totals.missed).toBeGreaterThan(0);
    expect(report.notVisited.length).toBeGreaterThan(0);
    expect(await count("SELECT count(*) AS total FROM submissions")).toBeGreaterThan(0);

    // Act
    await runCompany(db, 2, 0, { confirmed: true, remove: true, out });

    // Assert
    expect(await count("SELECT count(*) AS total FROM activities")).toBe(0);
    expect(await count("SELECT count(*) AS total FROM accounts")).toBe(0);
    expect(await count("SELECT count(*) AS total FROM users WHERE remarks = 'DEMO_DATA'")).toBe(0);
  });

  it("skips a company without a visit type", async () => {
    // Act
    await runCompany(db, 1, 0, { confirmed: true, remove: false, out });

    // Assert
    expect(out.mock.calls[0][0]).toMatch(/needs an active Manager\/Admin and a visit type/);
  });
});
