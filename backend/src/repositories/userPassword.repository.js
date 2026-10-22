const { connectDb, sql } = require("../config/db");
const logger = require("../utils/logger");

const REVOKE_REASON = "PASSWORD_RESET";

async function updatePassword(transaction, entry) {
  const result = await transaction.request()
    .input("userId", sql.Int, entry.userId)
    .input("passwordHash", sql.NVarChar(500), entry.passwordHash)
    .input("passwordSalt", sql.NVarChar(200), entry.passwordSalt)
    .input("passwordIterations", sql.Int, entry.passwordIterations)
    .input("updatedBy", sql.Int, entry.updatedBy)
    .query(`
      UPDATE Users SET
        PasswordHash = @passwordHash,
        PasswordSalt = @passwordSalt,
        PasswordIterations = @passwordIterations,
        LastPasswordChangedUtc = SYSDATETIMEOFFSET(),
        FailedLoginCount = 0,
        LockoutEndUtc = NULL,
        UpdatedAtUtc = SYSDATETIMEOFFSET(),
        UpdatedBy = @updatedBy
      WHERE Id = @userId AND IsDeleted = 0
    `);
  return result.rowsAffected[0] > 0;
}

async function revokeAllSessions(transaction, userId) {
  const result = await transaction.request()
    .input("userId", sql.Int, userId)
    .input("reason", sql.NVarChar(50), REVOKE_REASON)
    .query(`
      UPDATE RefreshTokens
      SET RevokedAtUtc = GETUTCDATE(),
          RevokedReason = @reason,
          UpdatedAtUtc = GETUTCDATE()
      WHERE UserId = @userId AND RevokedAtUtc IS NULL
    `);
  return result.rowsAffected[0];
}

// Sets a new password and ends every open session of the user in one transaction, so a
// reset can never leave old refresh tokens usable. Also clears any login lockout.
async function resetPassword(entry) {
  const pool = await connectDb();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const updated = await updatePassword(transaction, entry);
    const revokedSessions = await revokeAllSessions(transaction, entry.userId);
    await transaction.commit();
    return { updated, revokedSessions };
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.warn({ err: rollbackErr }, "Transaction rollback failed");
    }
    throw err;
  }
}

module.exports = { resetPassword, REVOKE_REASON };
