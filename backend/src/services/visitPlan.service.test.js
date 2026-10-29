/* eslint-disable @stylistic/max-len -- readable one-line fixture rows and test names */
jest.mock("../repositories/visitPlan.repository");
jest.mock("./audit.service", () => ({ log: jest.fn() }));
jest.mock("../config/db", () => ({ withTransaction: jest.fn((work) => work("tx")) }));

const repo = require("../repositories/visitPlan.repository");
const auditService = require("./audit.service");
const service = require("./visitPlan.service");

const ADMIN = { id: 10, companyId: 2, roleCode: "ADMIN" };
const REQ = { ipAddress: "10.0.0.1", userAgent: "jest" };
const NEED = {
  account_id: 7, account_name: "Dr. Alpha", user_id: 30, user_name: "Eve", visits_per_month: 3,
};

beforeEach(() => {
  jest.clearAllMocks();
  repo.companyClock.mockResolvedValue({ time_zone: "Asia/Kolkata", today: "2026-10-29" });
  repo.activeActivityTypes.mockResolvedValue([{ id: 5, name: "Doctor Visit" }]);
  repo.coverageNeeds.mockResolvedValue([{ ...NEED, existing: 1 }]);
  repo.insertPlanned.mockResolvedValue([101, 102]);
});

describe("visitPlan.service preview", () => {
  it("plans only the visits still missing (target 3 - existing 1 = 2)", async () => {
    // Act
    const plan = await service.preview(ADMIN, { month: "2026-11" });

    // Assert
    expect(plan.activityType).toEqual({ id: 5, name: "Doctor Visit" });
    expect(plan.items[0]).toMatchObject({ existing: 1, toCreate: 2 });
    expect(plan.totals).toEqual({
      reps: 1, accounts: 1, alreadyPlanned: 1, toCreate: 2,
    });
  });

  it("rejects a past month", async () => {
    // Act
    const run = service.preview(ADMIN, { month: "2026-09" });

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400 });
  });

  it("asks for a visit type when the company has several", async () => {
    // Arrange
    repo.activeActivityTypes.mockResolvedValue([{ id: 5, name: "A" }, { id: 6, name: "B" }]);

    // Act
    const run = service.preview(ADMIN, { month: "2026-11" });

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400, message: "Choose a visit type." });
  });

  it("refuses a visit type of another company", async () => {
    // Act
    const run = service.preview(ADMIN, { month: "2026-11", activityTypeId: 99 });

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400, errorCode: "CROSS_COMPANY_REFERENCE" });
  });

  it("explains when there is no visit type yet", async () => {
    // Arrange
    repo.activeActivityTypes.mockResolvedValue([]);

    // Act
    const run = service.preview(ADMIN, { month: "2026-11" });

    // Assert
    await expect(run).rejects.toMatchObject({ message: "Create a visit type in Settings first." });
  });

  it("returns 404 for an unknown company", async () => {
    // Arrange
    repo.companyClock.mockResolvedValue(null);

    // Act
    const run = service.preview(ADMIN, { month: "2026-11" });

    // Assert
    await expect(run).rejects.toMatchObject({ status: 404 });
  });
});

describe("visitPlan.service generate", () => {
  it("locks, inserts the planned visits as arrays and audits the run", async () => {
    // Act
    const result = await service.generate(ADMIN, { month: "2026-11", activityTypeId: 5 }, REQ);

    // Assert
    expect(result).toEqual({ month: "2026-11", created: 2 });
    expect(repo.lockPlan).toHaveBeenCalledWith("tx", 2, "2026-11-01");
    const plan = repo.insertPlanned.mock.calls[0][1];
    expect(plan).toMatchObject({
      companyId: 2, activityTypeId: 5, userId: 10, timeZone: "Asia/Kolkata", planMonth: "2026-11-01",
    });
    expect(plan.accountIds).toEqual([7, 7]);
    expect(plan.titles).toEqual(["Visit: Dr. Alpha", "Visit: Dr. Alpha"]);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "VISIT_PLAN_GENERATED", entityId: "2:2026-11", newValue: expect.objectContaining({ created: 2 }),
    }));
  });

  it("inserts nothing when every target is already planned", async () => {
    // Arrange
    repo.coverageNeeds.mockResolvedValue([{ ...NEED, existing: 3 }]);

    // Act
    const result = await service.generate(ADMIN, { month: "2026-11" }, REQ);

    // Assert
    expect(result.created).toBe(0);
    expect(repo.insertPlanned).not.toHaveBeenCalled();
  });
});
