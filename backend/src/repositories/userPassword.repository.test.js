const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const { mockTransactionalPool } = require("../../test/helpers/transactionPool");
const { affected } = require("../../test/helpers/apiHarness");
const repository = require("./userPassword.repository");

const ENTRY = {
  userId: 7,
  passwordHash: "hash",
  passwordSalt: "salt",
  passwordIterations: 10000,
  updatedBy: 1,
};

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("userPassword.repository resetPassword", () => {
  it("updates the hash, clears lockout and revokes all sessions in one transaction", async () => {
    // Arrange
    const { queries, tx } = await mockTransactionalPool(mockConnectDb, [
      affected(1), affected(3),
    ]);

    // Act
    const result = await repository.resetPassword(ENTRY);

    // Assert
    expect(result).toEqual({ updated: true, revokedSessions: 3 });
    expect(tx).toEqual(["begin", "commit"]);
    expect(queries[0].text).toContain("FailedLoginCount = 0");
    expect(queries[0].text).toContain("LockoutEndUtc = NULL");
    expect(queries[0].text).toContain("WHERE Id = @userId AND IsDeleted = 0");
    expect(queries[0].inputs).toMatchObject({
      userId: 7,
      passwordHash: "hash",
      passwordSalt: "salt",
      passwordIterations: 10000,
      updatedBy: 1,
    });
    expect(queries[1].text).toContain("WHERE UserId = @userId AND RevokedAtUtc IS NULL");
    expect(queries[1].inputs).toMatchObject({ userId: 7, reason: "PASSWORD_RESET" });
  });

  it("rolls back and rethrows when revoking sessions fails", async () => {
    // Arrange
    const { tx } = await mockTransactionalPool(mockConnectDb, [affected(1), new Error("boom")]);

    // Act
    const run = repository.resetPassword(ENTRY);

    // Assert
    await expect(run).rejects.toThrow("boom");
    expect(tx).toEqual(["begin", "rollback"]);
  });
});
