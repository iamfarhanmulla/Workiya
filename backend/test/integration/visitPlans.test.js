/* eslint-disable @stylistic/max-len -- readable one-line fixture rows and test names */
const { useTestDb, closeTestDb, seedBasics } = require("./helpers/testDb");
const visitPlanService = require("../../src/services/visitPlan.service");
const missedVisitsService = require("../../src/services/missedVisits.service");
const reportService = require("../../src/services/report.service");
const { USERS } = require("../helpers/apiHarness");

const COMPANY = 2;
const REQ = { ipAddress: "10.0.0.1", userAgent: "integration-test" };
let db;
let refs;

// Two months ahead, so the month is always in the future whenever the test runs.
function futureMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 2);
  return date.toISOString().slice(0, 7);
}

async function insertActivity(fields) {
  const { rows } = await db.query(`
    INSERT INTO activities (company_id, activity_type_id, account_id, assigned_to, assigned_by,
      title, status, due_at, completed_at)
    VALUES (@companyId, @typeId, @accountId, @assignedTo, 10, 'Manual', @status::varchar,
      (now() AT TIME ZONE 'Asia/Kolkata')::date + @dayOffset::int + time '12:00'
        AT TIME ZONE 'Asia/Kolkata',
      CASE WHEN @status::varchar = 'Completed' THEN now() END)
    RETURNING id`, { companyId: COMPANY, typeId: refs.typeId, ...fields });
  return rows[0].id;
}

beforeAll(async () => {
  db = await useTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await seedBasics();
  const type = await db.query(`INSERT INTO activity_types (company_id, code, name)
    VALUES (2, 'DOCTOR_VISIT', 'Doctor Visit') RETURNING id`);
  const accounts = await db.query(`INSERT INTO accounts (company_id, name)
    VALUES (2, 'Dr. Alpha'), (2, 'Dr. Beta') RETURNING id`);
  const [alpha, beta] = accounts.rows.map((row) => row.id);
  await db.query(`INSERT INTO account_assignments (company_id, account_id, user_id, visits_per_month)
    VALUES (2, @alpha, 30, 2), (2, @beta, 30, 1), (2, @alpha, 20, 1)`, { alpha, beta });
  refs = { typeId: type.rows[0].id, alpha, beta };
});

describe("visit plan generation", () => {
  it("previews the missing visits on working days of the month", async () => {
    // Arrange
    const month = futureMonth();

    // Act
    const plan = await visitPlanService.preview(USERS.admin, { month });

    // Assert
    expect(plan.totals).toMatchObject({
      reps: 2, accounts: 2, toCreate: 4, alreadyPlanned: 0,
    });
    const dates = plan.items.flatMap((item) => item.dates);
    expect(dates.every((d) => d.startsWith(month))).toBe(true);
    expect(dates.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0)).toBe(true);
  });

  it("creates the plan once: a second run adds nothing", async () => {
    // Arrange
    const month = futureMonth();

    // Act
    const first = await visitPlanService.generate(USERS.admin, { month }, REQ);
    const second = await visitPlanService.generate(USERS.admin, { month }, REQ);

    // Assert
    expect(first.created).toBe(4);
    expect(second.created).toBe(0);
    const { rows } = await db.query(`SELECT source, to_char(plan_month, 'YYYY-MM') AS plan_month,
        to_char(due_at AT TIME ZONE 'Asia/Kolkata', 'HH24:MI') AS local_time
      FROM activities WHERE company_id = 2`);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.source === "PLAN" && r.plan_month === month)).toBe(true);
    expect(rows.every((r) => r.local_time === "18:00")).toBe(true);
    const audit = await db.query("SELECT count(*)::int AS n FROM audit_logs WHERE event_type = 'VISIT_PLAN_GENERATED'");
    expect(audit.rows[0].n).toBe(2);
  });

  it("refuses a month that is already over", async () => {
    // Act
    const run = visitPlanService.preview(USERS.admin, { month: "2020-01" });

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400 });
  });
});

describe("missed visits job", () => {
  it("marks only overdue open visits as Missed and audits them", async () => {
    // Arrange
    const overdue = await insertActivity({
      accountId: refs.alpha, assignedTo: 30, status: "Pending", dayOffset: -1,
    });
    const today = await insertActivity({
      accountId: refs.alpha, assignedTo: 30, status: "Pending", dayOffset: 0,
    });
    const done = await insertActivity({
      accountId: refs.beta, assignedTo: 30, status: "Completed", dayOffset: -1,
    });

    // Act
    const result = await missedVisitsService.markMissed({ companyId: COMPANY });

    // Assert
    expect(result).toEqual({ marked: 1, companies: 1 });
    const { rows } = await db.query("SELECT id, status FROM activities ORDER BY id");
    const status = Object.fromEntries(rows.map((r) => [r.id, r.status]));
    expect(status).toEqual({ [overdue]: "Missed", [today]: "Pending", [done]: "Completed" });
    const history = await db.query("SELECT count(*)::int AS n FROM activities_history WHERE id = @overdue", { overdue });
    expect(history.rows[0].n).toBe(1);
  });
});

describe("coverage report", () => {
  it("counts targets, completed and missed per rep and lists not-visited accounts", async () => {
    // Arrange
    await insertActivity({
      accountId: refs.alpha, assignedTo: 30, status: "Completed", dayOffset: 0,
    });
    await insertActivity({
      accountId: refs.alpha, assignedTo: 20, status: "Missed", dayOffset: 0,
    });

    // Act
    const report = await reportService.coverage(USERS.admin, {});

    // Assert
    expect(report.totals).toMatchObject({
      target: 4, completed: 1, missed: 1, coveragePercent: 25,
    });
    const eve = report.byRep.find((rep) => rep.userId === 30);
    expect(eve).toMatchObject({
      target: 3, accounts: 2, completed: 1, coveragePercent: 33,
    });
    const notVisited = report.notVisited.map((row) => `${row.userId}:${row.accountId}`).sort();
    expect(notVisited).toEqual([`20:${refs.alpha}`, `30:${refs.beta}`].sort());
  });

  it("shows an employee only their own numbers", async () => {
    // Arrange
    await insertActivity({
      accountId: refs.alpha, assignedTo: 20, status: "Missed", dayOffset: 0,
    });

    // Act
    const report = await reportService.coverage(USERS.employee, {});

    // Assert
    expect(report.byRep.map((rep) => rep.userId)).toEqual([30]);
    expect(report.totals.missed).toBe(0);
  });

  it("returns a weekly trend with empty weeks filled in", async () => {
    // Arrange
    await insertActivity({
      accountId: refs.alpha, assignedTo: 30, status: "Completed", dayOffset: 0,
    });

    // Act
    const weeks = await reportService.trend(USERS.admin, { weeks: 4 });

    // Assert
    expect(weeks).toHaveLength(4);
    expect(weeks.at(-1).completed).toBe(1);
    expect(weeks.slice(0, 3).every((w) => w.completed === 0 && w.missed === 0)).toBe(true);
  });
});
