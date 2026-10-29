/* eslint-disable @stylistic/max-len -- readable one-line fixture rows and test names */
jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const { rows } = require("../../test/helpers/mockDb");
const repository = require("./visitPlan.repository");
const reportRepository = require("./report.repository");

beforeEach(() => {
  db.reset();
});

describe("visitPlan.repository", () => {
  it("reads the company clock and active visit types", async () => {
    // Arrange
    db.reset([rows({ time_zone: "Asia/Kolkata", today: "2026-10-29" }), rows({ id: 5 })]);

    // Act
    const clock = await repository.companyClock(2);
    const types = await repository.activeActivityTypes(2);

    // Assert
    expect(clock.today).toBe("2026-10-29");
    expect(types).toEqual([{ id: 5 }]);
    const [first, second] = db.statements();
    expect(first.text).toContain("now() AT TIME ZONE time_zone");
    expect(second.text).toContain("is_active AND NOT is_deleted");
  });

  it("returns null for an unknown company", async () => {
    // Arrange
    db.reset([rows()]);

    // Act
    const clock = await repository.companyClock(9);

    // Assert
    expect(clock).toBeNull();
  });

  it("counts existing visits in the month by local due date", async () => {
    // Arrange
    db.reset([rows({ account_id: 7 })]);

    // Act
    await repository.coverageNeeds(db, {
      companyId: 2, timeZone: "Asia/Kolkata", start: "2026-11-01", end: "2026-11-30",
    });

    // Assert
    const [statement] = db.statements();
    expect(statement.text).toContain("x.status <> 'Cancelled'");
    expect(statement.params).toMatchObject({ companyId: 2, start: "2026-11-01", end: "2026-11-30" });
  });

  it("locks per company and month, then bulk-inserts PLAN visits", async () => {
    // Arrange
    db.reset([rows(), rows({ id: 1 }, { id: 2 })]);

    // Act
    await repository.lockPlan(db, 2, "2026-11-01");
    const ids = await repository.insertPlanned(db, {
      companyId: 2,
      activityTypeId: 5,
      userId: 10,
      timeZone: "Asia/Kolkata",
      planMonth: "2026-11-01",
      accountIds: [7, 8],
      assignedTos: [30, 30],
      dueDates: ["2026-11-03", "2026-11-17"],
      titles: ["a", "b"],
    });

    // Assert
    expect(ids).toEqual([1, 2]);
    const [lock, insert] = db.statements();
    expect(lock.text).toContain("pg_advisory_xact_lock");
    expect(insert.text).toContain("unnest(@accountIds::int[]");
    expect(insert.text).toContain("'PLAN'");
  });

  it("marks overdue visits missed for one company or all", async () => {
    // Arrange
    db.reset([rows({ id: 1, company_id: 2 }), rows()]);

    // Act
    const one = await repository.markMissed(2);
    await repository.markMissed(null);

    // Assert
    expect(one).toEqual([{ id: 1, company_id: 2 }]);
    const [scoped, all] = db.statements();
    expect(scoped.text).toContain("x.status IN ('Pending', 'InProgress')");
    expect(scoped.params).toEqual({ companyId: 2 });
    expect(all.params).toEqual({ companyId: null });
  });
});

describe("report.repository", () => {
  const PARAMS = {
    companyId: 2, timeZone: "Asia/Kolkata", start: "2026-10-01", end: "2026-10-31", userId: 30,
  };

  it("filters every report query by company, month and optional rep", async () => {
    // Arrange
    db.reset([rows(), rows(), rows(), rows()]);

    // Act
    await reportRepository.statusByRep(PARAMS);
    await reportRepository.targetsByRep(PARAMS);
    await reportRepository.notVisited(PARAMS);
    await reportRepository.weeklyTrend({ ...PARAMS, from: "2026-09-07", today: "2026-10-29" });

    // Assert
    const statements = db.statements();
    statements.forEach((statement) => expect(statement.text).toContain("company_id = @companyId"));
    expect(statements[0].text).toContain("review_status = 'Approved'");
    expect(statements[2].text).toContain("NOT EXISTS");
    expect(statements[3].text).toContain("date_trunc('week'");
  });
});
