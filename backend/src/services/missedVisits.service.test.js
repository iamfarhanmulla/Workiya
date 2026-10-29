jest.mock("../repositories/visitPlan.repository");
jest.mock("./audit.service", () => ({ log: jest.fn() }));

const repo = require("../repositories/visitPlan.repository");
const auditService = require("./audit.service");
const service = require("./missedVisits.service");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("missedVisits.service markMissed", () => {
  it("writes one audit entry per company with the marked ids", async () => {
    // Arrange
    repo.markMissed.mockResolvedValue([
      { id: 1, company_id: 2 }, { id: 2, company_id: 2 }, { id: 3, company_id: 5 },
    ]);

    // Act
    const result = await service.markMissed();

    // Assert
    expect(repo.markMissed).toHaveBeenCalledWith(null);
    expect(result).toEqual({ marked: 3, companies: 2 });
    expect(auditService.log).toHaveBeenCalledTimes(2);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "MISSED_VISITS_MARKED",
      companyId: 2,
      performedBy: null,
      newValue: { count: 2, activityIds: [1, 2] },
    }));
  });

  it("passes the company and actor of a manual run", async () => {
    // Arrange
    repo.markMissed.mockResolvedValue([]);

    // Act
    const result = await service.markMissed({
      companyId: 2, performedBy: 10, requestCtx: { ipAddress: "1.2.3.4" },
    });

    // Assert
    expect(repo.markMissed).toHaveBeenCalledWith(2);
    expect(result).toEqual({ marked: 0, companies: 0 });
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
