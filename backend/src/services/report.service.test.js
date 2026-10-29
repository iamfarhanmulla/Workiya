/* eslint-disable @stylistic/max-len -- readable one-line fixture rows and test names */
jest.mock("../repositories/report.repository");
jest.mock("../repositories/visitPlan.repository");

const reportRepository = require("../repositories/report.repository");
const visitPlanRepository = require("../repositories/visitPlan.repository");
const service = require("./report.service");

const ADMIN = { id: 10, companyId: 2, roleCode: "ADMIN" };
const EMPLOYEE = { id: 30, companyId: 2, roleCode: "EMPLOYEE" };

beforeEach(() => {
  jest.clearAllMocks();
  visitPlanRepository.companyClock.mockResolvedValue({ time_zone: "Asia/Kolkata", today: "2026-10-29" });
  reportRepository.statusByRep.mockResolvedValue([{
    user_id: 30, user_name: "Eve", scheduled: 4, completed: 3, missed: 1, open: 0, cancelled: 0, approved: 2,
  }]);
  reportRepository.targetsByRep.mockResolvedValue([
    {
      user_id: 30, user_name: "Eve", target: 4, accounts: 2,
    },
    {
      user_id: 20, user_name: "Max", target: 2, accounts: 1,
    },
  ]);
  reportRepository.notVisited.mockResolvedValue([{
    account_id: 7, account_name: "Dr. Beta", user_id: 20, user_name: "Max", visits_per_month: 2, last_visit_at: null,
  }]);
  reportRepository.weeklyTrend.mockResolvedValue([{ week_start: "2026-10-26", completed: 2, missed: 1 }]);
});

describe("report.service coverage", () => {
  it("merges targets and statuses per rep with coverage and approval rates", async () => {
    // Act
    const report = await service.coverage(ADMIN, { month: "2026-10" });

    // Assert
    expect(report.month).toBe("2026-10");
    expect(report.byRep.map((rep) => rep.userName)).toEqual(["Eve", "Max"]);
    expect(report.byRep[0]).toMatchObject({
      target: 4, completed: 3, coveragePercent: 75, approvalPercent: 67,
    });
    expect(report.byRep[1]).toMatchObject({
      target: 2, completed: 0, coveragePercent: 0, approvalPercent: null,
    });
    expect(report.totals).toMatchObject({ target: 6, completed: 3, coveragePercent: 50 });
    expect(report.notVisited[0]).toEqual({
      accountId: 7, accountName: "Dr. Beta", userId: 20, userName: "Max", visitsPerMonth: 2, lastVisitAt: null,
    });
    expect(reportRepository.statusByRep.mock.calls[0][0]).toMatchObject({
      companyId: 2, userId: null, start: "2026-10-01", end: "2026-10-31", timeZone: "Asia/Kolkata",
    });
  });

  it("defaults to the current month and limits an employee to their own rows", async () => {
    // Act
    await service.coverage(EMPLOYEE, {});

    // Assert
    expect(reportRepository.statusByRep.mock.calls[0][0]).toMatchObject({ userId: 30, start: "2026-10-01" });
  });

  it("uses scheduled visits as the base when a rep has no target", () => {
    // Act
    const [rep] = service.mergeByRep([{
      user_id: 1, user_name: "A", scheduled: 2, completed: 1, missed: 0, open: 1, cancelled: 0, approved: 0,
    }], []);

    // Assert
    expect(rep.coveragePercent).toBe(50);
  });

  it("returns 404 for an unknown company", async () => {
    // Arrange
    visitPlanRepository.companyClock.mockResolvedValue(null);

    // Act
    const run = service.coverage(ADMIN, {});

    // Assert
    await expect(run).rejects.toMatchObject({ status: 404 });
  });
});

describe("report.service trend", () => {
  it("returns N Monday-based weeks ending this week, filling gaps with zeros", async () => {
    // Act
    const weeks = await service.trend(ADMIN, { weeks: 3 });

    // Assert
    expect(weeks).toEqual([
      { weekStart: "2026-10-12", completed: 0, missed: 0 },
      { weekStart: "2026-10-19", completed: 0, missed: 0 },
      { weekStart: "2026-10-26", completed: 2, missed: 1 },
    ]);
    expect(reportRepository.weeklyTrend.mock.calls[0][0]).toMatchObject({ from: "2026-10-12" });
  });

  it("defaults to 8 weeks", async () => {
    // Act
    const weeks = await service.trend(ADMIN, {});

    // Assert
    expect(weeks).toHaveLength(8);
  });
});
