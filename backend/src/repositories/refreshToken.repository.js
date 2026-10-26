const db = require("../config/db");

async function insert(token) {
  const { rows } = await db.query(`
    INSERT INTO refresh_tokens
      (user_id, company_id, token_hash, family_id, is_persistent, expires_at,
       created_by_ip, user_agent, created_by, updated_by)
    VALUES
      (@userId, @companyId, @tokenHash, @familyId, @isPersistent, @expiresAt,
       @createdByIp, @userAgent, @userId, @userId)
    RETURNING id
  `, {
    userId: token.userId,
    companyId: token.companyId ?? null,
    tokenHash: token.tokenHash,
    familyId: token.familyId,
    isPersistent: Boolean(token.isPersistent),
    expiresAt: token.expiresAtUtc,
    createdByIp: token.createdByIp ?? null,
    userAgent: token.userAgent ?? null,
  });
  return rows[0].id;
}

async function findByHash(tokenHash) {
  const { rows } = await db.query(`
    SELECT id, user_id, company_id, token_hash, family_id, is_persistent, expires_at,
      revoked_at, revoked_reason, replaced_by_token_hash
    FROM refresh_tokens
    WHERE token_hash = @tokenHash AND NOT is_deleted
  `, { tokenHash });
  return rows[0] || null;
}

async function revoke(id, reason, replacedByHash) {
  const { rowCount } = await db.query(`
    UPDATE refresh_tokens
    SET revoked_at = now(),
        revoked_reason = @reason,
        replaced_by_token_hash = @replacedByHash,
        updated_at = now()
    WHERE id = @id AND revoked_at IS NULL
  `, { id, reason, replacedByHash: replacedByHash || null });
  return rowCount > 0;
}

async function revokeFamily(familyId, reason) {
  await db.query(`
    UPDATE refresh_tokens
    SET revoked_at = now(),
        revoked_reason = @reason,
        updated_at = now()
    WHERE family_id = @familyId AND revoked_at IS NULL
  `, { familyId, reason });
}

module.exports = {
  insert, findByHash, revoke, revokeFamily,
};
