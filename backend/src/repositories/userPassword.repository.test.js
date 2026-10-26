jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const { affected } = require("../../test/helpers/mockDb");
const repository = require("./userPassword.repository");

const ENTRY = {
  userId: 7,
  passwordHash: "$argon2id$hash",
  passwordSalt: "",
  passwordIterations: 0,
  updatedBy: 1,
};

beforeEach(() => {
  db.reset();
});

describe("userPassword.repository resetPassword", () => {
  it("updates the hash, clears lockout and revokes all sessions in one transaction", async () => {
    // Arrange
    db.reset([affected(1), affected(3)]);

    // Act
    const result = await repository.resetPassword(ENTRY);

    // Assert
    expect(result).toEqual({ updated: true, revokedSessions: 3 });
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const [update, revoke] = db.statements();
    expect(update.text).toContain("failed_login_count = 0");
    expect(update.text).toContain("lockout_end_at = NULL");
    expect(update.text).toContain("last_password_changed_at = now()");
    expect(update.text).toContain("WHERE id = @userId AND NOT is_deleted");
    expect(update.params).toEqual(ENTRY);
    expect(revoke.text).toContain("WHERE user_id = @userId AND revoked_at IS NULL");
    expect(revoke.params).toEqual({ userId: 7, reason: "PASSWORD_RESET" });
  });

  it("reports a missing user as not updated", async () => {
    // Arrange
    db.reset([affected(0), affected(0)]);

    // Act
    const result = await repository.resetPassword(ENTRY);

    // Assert
    expect(result).toEqual({ updated: false, revokedSessions: 0 });
  });

  it("rolls back and rethrows when revoking sessions fails", async () => {
    // Arrange
    db.reset([affected(1), new Error("boom")]);

    // Act
    const run = repository.resetPassword(ENTRY);

    // Assert
    await expect(run).rejects.toThrow("boom");
    expect(db.transactionLog()).toEqual(["BEGIN", "ROLLBACK"]);
  });
});
