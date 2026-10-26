const db = require("../config/db");

const REVOKE_REASON = "PASSWORD_RESET";

async function updatePassword(tx, entry) {
  const { rowCount } = await tx.query(`
    UPDATE users SET
      password_hash = @passwordHash,
      password_salt = @passwordSalt,
      password_iterations = @passwordIterations,
      last_password_changed_at = now(),
      failed_login_count = 0,
      lockout_end_at = NULL,
      updated_at = now(),
      updated_by = @updatedBy
    WHERE id = @userId AND NOT is_deleted
  `, {
    userId: entry.userId,
    passwordHash: entry.passwordHash,
    passwordSalt: entry.passwordSalt,
    passwordIterations: entry.passwordIterations,
    updatedBy: entry.updatedBy,
  });
  return rowCount > 0;
}

async function revokeAllSessions(tx, userId) {
  const { rowCount } = await tx.query(`
    UPDATE refresh_tokens
    SET revoked_at = now(),
        revoked_reason = @reason,
        updated_at = now()
    WHERE user_id = @userId AND revoked_at IS NULL
  `, { userId, reason: REVOKE_REASON });
  return rowCount;
}

// Sets a new password and ends every open session of the user in one transaction, so a
// reset can never leave old refresh tokens usable. Also clears any login lockout.
async function resetPassword(entry) {
  return db.withTransaction(async (tx) => {
    const updated = await updatePassword(tx, entry);
    const revokedSessions = await revokeAllSessions(tx, entry.userId);
    return { updated, revokedSessions };
  });
}

module.exports = { resetPassword, REVOKE_REASON };
