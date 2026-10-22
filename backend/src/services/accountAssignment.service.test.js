jest.mock("../repositories/account.repository");
jest.mock("../repositories/accountAssignment.repository");
jest.mock("./audit.service");
jest.mock("./companyContext");

const accountRepository = require("../repositories/account.repository");
const assignmentRepository = require("../repositories/accountAssignment.repository");
const auditService = require("./audit.service");
const { requireCompanyId } = require("./companyContext");
const assignmentService = require("./accountAssignment.service");
const { USERS } = require("../../test/helpers/apiHarness");

const CTX = { ipAddress: "10.0.0.1", userAgent: "jest" };
const ACCOUNT = { Id: 4, CompanyId: 2 };

beforeEach(() => {
  accountRepository.withTransaction.mockImplementation((work) => work("tx"));
  accountRepository.findById.mockResolvedValue(ACCOUNT);
  assignmentRepository.listByAccountIds.mockResolvedValue([]);
  requireCompanyId.mockReturnValue(2);
});

describe("accountAssignment.service list", () => {
  it("lists the account's reps with their role", async () => {
    // Arrange
    assignmentRepository.listByAccountIds.mockResolvedValue([
      {
        AccountId: 4, UserId: 30, DisplayName: "Rep A", RoleCode: "EMPLOYEE", VisitsPerMonth: 2,
      },
    ]);

    // Act
    const result = await assignmentService.list(USERS.manager, 4);

    // Assert
    expect(accountRepository.findById).toHaveBeenCalledWith(4, { user: USERS.manager });
    expect(result).toEqual([{
      userId: 30, displayName: "Rep A", roleCode: "EMPLOYEE", visitsPerMonth: 2,
    }]);
  });

  it("returns 404 for an account outside the caller's company", async () => {
    // Arrange
    accountRepository.findById.mockResolvedValue(null);

    // Act
    const run = assignmentService.list(USERS.manager, 4);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
  });
});

describe("accountAssignment.service replace", () => {
  it("rejects a user who is not an assignable rep of the account's company", async () => {
    // Arrange
    assignmentRepository.findAssignableUserIds.mockResolvedValue([30]);

    // Act
    const run = assignmentService.replace(USERS.manager, 4, [
      { userId: 30, visitsPerMonth: null },
      { userId: 99, visitsPerMonth: 2 },
    ], CTX);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400, errorCode: "CROSS_COMPANY_REFERENCE" });
    expect(assignmentRepository.findAssignableUserIds).toHaveBeenCalledWith(2, [30, 99]);
    expect(accountRepository.withTransaction).not.toHaveBeenCalled();
  });

  it(
    "ends removed reps, adds new ones and updates changed visit targets in one transaction",
    async () => {
      // Arrange
      assignmentRepository.findAssignableUserIds.mockResolvedValue([30, 31, 32]);
      assignmentRepository.lockActiveForAccount.mockResolvedValue([
        { Id: 1, UserId: 30, VisitsPerMonth: 2 },
        { Id: 2, UserId: 31, VisitsPerMonth: null },
        { Id: 3, UserId: 33, VisitsPerMonth: 4 },
      ]);
      const wanted = [
        { userId: 30, visitsPerMonth: 2 },
        { userId: 31, visitsPerMonth: 6 },
        { userId: 32, visitsPerMonth: null },
      ];

      // Act
      await assignmentService.replace(USERS.manager, 4, wanted, CTX);

      // Assert
      expect(assignmentRepository.lockActiveForAccount).toHaveBeenCalledWith(4, "tx");
      expect(assignmentRepository.softDeleteByIds).toHaveBeenCalledWith([3], 20, "tx");
      expect(assignmentRepository.insertMany).toHaveBeenCalledWith(2, [
        { userId: 32, visitsPerMonth: null, accountId: 4 },
      ], 20, "tx");
      expect(assignmentRepository.updateVisits).toHaveBeenCalledTimes(1);
      expect(assignmentRepository.updateVisits).toHaveBeenCalledWith(2, 6, 20, "tx");
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        eventType: "ACCOUNT_ASSIGNMENTS_CHANGED",
        entityType: "Account",
        entityId: 4,
        companyId: 2,
        performedBy: 20,
        newValue: wanted,
      }));
    },
  );

  it("writes and audits nothing when the set is unchanged", async () => {
    // Arrange
    assignmentRepository.findAssignableUserIds.mockResolvedValue([30]);
    assignmentRepository.lockActiveForAccount.mockResolvedValue([
      { Id: 1, UserId: 30, VisitsPerMonth: null },
    ]);

    // Act
    await assignmentService.replace(USERS.manager, 4, [{ userId: 30, visitsPerMonth: null }], CTX);

    // Assert
    expect(assignmentRepository.softDeleteByIds).not.toHaveBeenCalled();
    expect(assignmentRepository.insertMany).not.toHaveBeenCalled();
    expect(assignmentRepository.updateVisits).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });
});

describe("accountAssignment.service transfer", () => {
  const BODY = { fromUserId: 30, toUserId: 31 };

  beforeEach(() => {
    assignmentRepository.isCompanyUser.mockResolvedValue(true);
    assignmentRepository.findAssignableUserIds.mockResolvedValue([31]);
  });

  it("moves assignments the new rep lacks and skips the ones they already cover", async () => {
    // Arrange
    assignmentRepository.lockActiveForUser
      .mockResolvedValueOnce([
        { Id: 1, AccountId: 4, VisitsPerMonth: 2 },
        { Id: 2, AccountId: 5, VisitsPerMonth: null },
      ])
      .mockResolvedValueOnce([{ Id: 9, AccountId: 5, VisitsPerMonth: 1 }]);

    // Act
    const result = await assignmentService.transfer(USERS.manager, BODY, CTX);

    // Assert
    expect(result).toEqual({ moved: 1 });
    expect(assignmentRepository.lockActiveForUser).toHaveBeenNthCalledWith(1, 2, 30, "tx");
    expect(assignmentRepository.lockActiveForUser).toHaveBeenNthCalledWith(2, 2, 31, "tx");
    expect(assignmentRepository.insertMany).toHaveBeenCalledWith(2, [
      { accountId: 4, userId: 31, visitsPerMonth: 2 },
    ], 20, "tx");
    expect(assignmentRepository.softDeleteByIds).toHaveBeenCalledWith([1, 2], 20, "tx");
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACCOUNTS_TRANSFERRED",
      newValue: { userId: 31, moved: 1, skipped: 1 },
    }));
  });

  it("does nothing and audits nothing when the old rep has no assignments", async () => {
    // Arrange
    assignmentRepository.lockActiveForUser.mockResolvedValue([]);

    // Act
    const result = await assignmentService.transfer(USERS.manager, BODY, CTX);

    // Assert
    expect(result).toEqual({ moved: 0 });
    expect(assignmentRepository.insertMany).not.toHaveBeenCalled();
    expect(assignmentRepository.softDeleteByIds).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("returns 409 CONFLICT when a parallel change inserted the same pair first", async () => {
    // Arrange
    assignmentRepository.lockActiveForUser
      .mockResolvedValueOnce([{ Id: 1, AccountId: 4, VisitsPerMonth: 2 }])
      .mockResolvedValueOnce([]);
    assignmentRepository.insertMany.mockRejectedValue(Object.assign(new Error("dup"), {
      number: 2601,
    }));

    // Act
    const run = assignmentService.transfer(USERS.manager, BODY, CTX);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("rethrows other database errors unchanged", async () => {
    // Arrange
    assignmentRepository.lockActiveForUser.mockRejectedValue(new Error("deadlock"));

    // Act
    const run = assignmentService.transfer(USERS.manager, BODY, CTX);

    // Assert
    await expect(run).rejects.toThrow("deadlock");
  });

  it("rejects a source user from another company", async () => {
    // Arrange
    assignmentRepository.isCompanyUser.mockResolvedValue(false);

    // Act
    const run = assignmentService.transfer(USERS.manager, BODY, CTX);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400, errorCode: "CROSS_COMPANY_REFERENCE" });
    expect(accountRepository.withTransaction).not.toHaveBeenCalled();
  });

  it("rejects a target user who is not an assignable rep of the company", async () => {
    // Arrange
    assignmentRepository.findAssignableUserIds.mockResolvedValue([]);

    // Act
    const run = assignmentService.transfer(USERS.manager, BODY, CTX);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 400, errorCode: "CROSS_COMPANY_REFERENCE" });
    expect(requireCompanyId).toHaveBeenCalledWith(USERS.manager, undefined);
  });
});
