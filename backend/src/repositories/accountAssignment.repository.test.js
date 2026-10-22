const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const assignmentRepository = require("./accountAssignment.repository");
const { mockPool, rows, affected } = require("../../test/helpers/apiHarness");

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("accountAssignment.repository reads", () => {
  it("loads assignments for a page of accounts in one parameterised query", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ AccountId: 1, UserId: 30 })]);

    // Act
    const result = await assignmentRepository.listByAccountIds([1, 2]);

    // Assert
    expect(result).toEqual([{ AccountId: 1, UserId: 30 }]);
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].text)
      .toContain("aa.IsDeleted = 0 AND aa.AccountId IN (@account0, @account1)");
    expect(db.queries[0].inputs).toEqual({ account0: 1, account1: 2 });
  });

  it.each([
    ["listByAccountIds", (repo) => repo.listByAccountIds([])],
    ["findAssignableUserIds", (repo) => repo.findAssignableUserIds(2, [])],
  ])("%s skips the database for an empty id list", async (_name, act) => {
    // Arrange
    const db = mockPool(mockConnectDb, []);

    // Act
    const result = await act(assignmentRepository);

    // Assert
    expect(result).toEqual([]);
    expect(db.queries).toHaveLength(0);
  });

  it("locks an account's active assignments", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 1 })]);

    // Act
    await assignmentRepository.lockActiveForAccount(4);

    // Assert
    expect(db.queries[0].text).toContain("WITH (UPDLOCK, HOLDLOCK)");
    expect(db.queries[0].text).toContain("AccountId = @accountId AND IsDeleted = 0");
    expect(db.queries[0].inputs).toEqual({ accountId: 4 });
  });

  it("locks a user's active assignments to live accounts of one company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows()]);

    // Act
    await assignmentRepository.lockActiveForUser(2, 30);

    // Assert
    const { text, inputs } = db.queries[0];
    expect(text).toContain("a.IsDeleted = 0");
    expect(text)
      .toContain("aa.CompanyId = @companyId AND aa.UserId = @userId AND aa.IsDeleted = 0");
    expect(inputs).toEqual({ companyId: 2, userId: 30 });
  });

  it("finds only active EMPLOYEE or MANAGER users of the company", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 30 })]);

    // Act
    const ids = await assignmentRepository.findAssignableUserIds(2, [30, 99]);

    // Assert
    expect(ids).toEqual([30]);
    const { text, inputs } = db.queries[0];
    expect(text).toContain("u.CompanyId = @companyId AND u.IsActive = 1 AND u.IsDeleted = 0");
    expect(text).toContain("r.Code IN (@employeeCode, @managerCode)");
    expect(inputs).toEqual({
      companyId: 2, employeeCode: "EMPLOYEE", managerCode: "MANAGER", user0: 30, user1: 99,
    });
  });

  it.each([
    [[rows({ Id: 30 })], true],
    [[rows()], false],
  ])("checks company membership of a user", async (responses, expected) => {
    // Arrange
    const db = mockPool(mockConnectDb, responses);

    // Act
    const result = await assignmentRepository.isCompanyUser(2, 30);

    // Assert
    expect(result).toBe(expected);
    expect(db.queries[0].inputs).toEqual({ companyId: 2, userId: 30 });
  });
});

describe("accountAssignment.repository writes", () => {
  it("inserts rows in chunks below the SQL Server parameter limit", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(500), affected(1)]);
    const newRows = Array.from({ length: 501 }, (_v, i) => ({
      accountId: i + 1, userId: 30, visitsPerMonth: i === 0 ? 4 : undefined,
    }));

    // Act
    await assignmentRepository.insertMany(2, newRows, 20);

    // Assert
    expect(db.queries).toHaveLength(2);
    expect(db.queries[0].text).toContain("(@companyId, @account0, @user0, @visits0,");
    expect(db.queries[0].inputs).toMatchObject({
      companyId: 2, createdBy: 20, account0: 1, user0: 30, visits0: 4, visits1: null,
    });
    expect(db.queries[1].inputs).toMatchObject({ account0: 501 });
  });

  it("soft-deletes assignments by id in chunks", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1000), affected(1)]);
    const ids = Array.from({ length: 1001 }, (_v, i) => i + 1);

    // Act
    await assignmentRepository.softDeleteByIds(ids, 20);

    // Assert
    expect(db.queries).toHaveLength(2);
    expect(db.queries[0].text)
      .toContain("SET IsDeleted = 1, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @updatedBy");
    expect(db.queries[1].inputs).toEqual({ updatedBy: 20, id0: 1001 });
  });

  it("updates the visit target of one active assignment", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    await assignmentRepository.updateVisits(5, 8, 20);

    // Assert
    expect(db.queries[0].text).toContain("WHERE Id = @id AND IsDeleted = 0");
    expect(db.queries[0].inputs).toEqual({ id: 5, visitsPerMonth: 8, updatedBy: 20 });
  });

  it("ends every active assignment of an account", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(2)]);

    // Act
    await assignmentRepository.softDeleteForAccount(4, 20);

    // Assert
    expect(db.queries[0].text).toContain("WHERE AccountId = @accountId AND IsDeleted = 0");
    expect(db.queries[0].inputs).toEqual({ accountId: 4, updatedBy: 20 });
  });
});
