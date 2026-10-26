jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const assignmentRepository = require("./accountAssignment.repository");
const { rows, affected } = require("../../test/helpers/mockDb");

beforeEach(() => {
  db.reset();
});

describe("accountAssignment.repository reads", () => {
  it("loads assignments for a page of accounts in one array-parameter query", async () => {
    // Arrange
    db.reset([rows({ account_id: 1, user_id: 30 })]);

    // Act
    const result = await assignmentRepository.listByAccountIds([1, 2]);

    // Assert
    expect(result).toEqual([{ account_id: 1, user_id: 30 }]);
    expect(db.calls).toHaveLength(1);
    const { text, params } = db.calls[0];
    expect(text).toContain("NOT aa.is_deleted AND aa.account_id = ANY(@accountIds::int[])");
    expect(text).toContain("AS display_name, r.code AS role_code");
    expect(params).toEqual({ accountIds: [1, 2] });
  });

  it.each([
    ["listByAccountIds", (repo) => repo.listByAccountIds([])],
    ["findAssignableUserIds", (repo) => repo.findAssignableUserIds(2, [])],
  ])("%s skips the database for an empty id list", async (_name, act) => {
    // Arrange / Act
    const result = await act(assignmentRepository);

    // Assert
    expect(result).toEqual([]);
    expect(db.calls).toHaveLength(0);
  });

  it("locks the account row, then its active assignments", async () => {
    // Arrange
    db.reset([rows({ id: 4 }), rows({ id: 1 })]);

    // Act
    const result = await assignmentRepository.lockActiveForAccount(4);

    // Assert
    expect(result).toEqual([{ id: 1 }]);
    const [account, assignments] = db.calls;
    expect(account.text).toContain("FROM accounts WHERE id = @accountId FOR NO KEY UPDATE");
    expect(assignments.text).toContain("account_id = @accountId AND NOT is_deleted");
    expect(assignments.text).toMatch(/FOR UPDATE$/);
    expect(assignments.params).toEqual({ accountId: 4 });
  });

  it("locks a user's active assignments to live accounts of one company", async () => {
    // Arrange / Act
    await assignmentRepository.lockActiveForUser(2, 30);

    // Assert
    const { text, params } = db.calls[0];
    expect(text).toContain("NOT a.is_deleted");
    expect(text)
      .toContain("aa.company_id = @companyId AND aa.user_id = @userId AND NOT aa.is_deleted");
    expect(text).toContain("FOR UPDATE OF aa");
    expect(params).toEqual({ companyId: 2, userId: 30 });
  });

  it("finds only active EMPLOYEE or MANAGER users of the company", async () => {
    // Arrange
    db.reset([rows({ id: 30 })]);

    // Act
    const ids = await assignmentRepository.findAssignableUserIds(2, [30, 99]);

    // Assert
    expect(ids).toEqual([30]);
    const { text, params } = db.calls[0];
    expect(text).toContain("u.company_id = @companyId AND u.is_active AND NOT u.is_deleted");
    expect(text).toContain("r.code IN (@employeeCode, @managerCode)");
    expect(params).toEqual({
      companyId: 2, employeeCode: "EMPLOYEE", managerCode: "MANAGER", userIds: [30, 99],
    });
  });

  it.each([
    [[rows({ id: 30 })], true],
    [[rows()], false],
  ])("checks company membership of a user", async (responses, expected) => {
    // Arrange
    db.reset(responses);

    // Act
    const result = await assignmentRepository.isCompanyUser(2, 30);

    // Assert
    expect(result).toBe(expected);
    expect(db.calls[0].params).toEqual({ companyId: 2, userId: 30 });
  });
});

describe("accountAssignment.repository writes", () => {
  it("inserts any number of rows in one statement from parallel arrays", async () => {
    // Arrange
    db.reset([affected(501)]);
    const newRows = Array.from({ length: 501 }, (_v, i) => ({
      accountId: i + 1, userId: 30, visitsPerMonth: i === 0 ? 4 : undefined,
    }));

    // Act
    await assignmentRepository.insertMany(2, newRows, 20);

    // Assert
    expect(db.calls).toHaveLength(1);
    const { text, params } = db.calls[0];
    expect(text).toContain("unnest(@accountIds::int[], @userIds::int[], @visits::smallint[])");
    expect(params).toMatchObject({ companyId: 2, createdBy: 20 });
    expect(params.accountIds).toHaveLength(501);
    expect(params.visits.slice(0, 2)).toEqual([4, null]);
  });

  it.each([
    ["insertMany", (repo) => repo.insertMany(2, [], 20)],
    ["softDeleteByIds", (repo) => repo.softDeleteByIds([], 20)],
  ])("%s skips the database for an empty list", async (_name, act) => {
    // Arrange / Act
    await act(assignmentRepository);

    // Assert
    expect(db.calls).toHaveLength(0);
  });

  it("soft-deletes assignments by id in one statement", async () => {
    // Arrange
    db.reset([affected(2)]);

    // Act
    await assignmentRepository.softDeleteByIds([1, 2], 20);

    // Assert
    const { text, params } = db.calls[0];
    expect(text).toContain("SET is_deleted = true, updated_at = now(), updated_by = @updatedBy");
    expect(text).toContain("id = ANY(@ids::int[])");
    expect(params).toEqual({ updatedBy: 20, ids: [1, 2] });
  });

  it("updates the visit target of one active assignment", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    await assignmentRepository.updateVisits(5, 8, 20);

    // Assert
    expect(db.calls[0].text).toContain("WHERE id = @id AND NOT is_deleted");
    expect(db.calls[0].params).toEqual({ id: 5, visitsPerMonth: 8, updatedBy: 20 });
  });

  it("ends every active assignment of an account on the caller's transaction", async () => {
    // Arrange
    const tx = { query: jest.fn().mockResolvedValue(affected(2)) };

    // Act
    await assignmentRepository.softDeleteForAccount(4, 20, tx);

    // Assert
    const [text, params] = tx.query.mock.calls[0];
    expect(text).toContain("WHERE account_id = @accountId AND NOT is_deleted");
    expect(params).toEqual({ accountId: 4, updatedBy: 20 });
    expect(db.query).not.toHaveBeenCalled();
  });
});
