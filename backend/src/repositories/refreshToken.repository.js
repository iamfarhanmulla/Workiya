const { connectDb, sql } = require("../config/db");

async function insert(token) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("userId", sql.Int, token.userId)
    .input("companyId", sql.Int, token.companyId)
    .input("tokenHash", sql.Char(64), token.tokenHash)
    .input("familyId", sql.UniqueIdentifier, token.familyId)
    .input("isPersistent", sql.Bit, token.isPersistent)
    .input("expiresAtUtc", sql.DateTime2(3), token.expiresAtUtc)
    .input("createdByIp", sql.NVarChar(45), token.createdByIp)
    .input("userAgent", sql.NVarChar(500), token.userAgent)
    .query(`
      INSERT INTO RefreshTokens
        (UserId, CompanyId, TokenHash, FamilyId, IsPersistent, ExpiresAtUtc,
         CreatedByIp, UserAgent, CreatedBy, UpdatedBy)
      OUTPUT inserted.Id
      VALUES
        (@userId, @companyId, @tokenHash, @familyId, @isPersistent, @expiresAtUtc,
         @createdByIp, @userAgent, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

async function findByHash(tokenHash) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("tokenHash", sql.Char(64), tokenHash)
    .query(`
      SELECT Id, UserId, CompanyId, TokenHash, FamilyId, IsPersistent, ExpiresAtUtc,
        RevokedAtUtc, RevokedReason, ReplacedByTokenHash
      FROM RefreshTokens
      WHERE TokenHash = @tokenHash AND IsDeleted = 0
    `);
  return result.recordset[0] || null;
}

async function revoke(id, reason, replacedByHash) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("id", sql.BigInt, id)
    .input("reason", sql.NVarChar(50), reason)
    .input("replacedByHash", sql.Char(64), replacedByHash || null)
    .query(`
      UPDATE RefreshTokens
      SET RevokedAtUtc = GETUTCDATE(),
          RevokedReason = @reason,
          ReplacedByTokenHash = @replacedByHash,
          UpdatedAtUtc = GETUTCDATE()
      WHERE Id = @id AND RevokedAtUtc IS NULL
    `);
  return result.rowsAffected[0] > 0;
}

async function revokeFamily(familyId, reason) {
  const pool = await connectDb();
  await pool
    .request()
    .input("familyId", sql.UniqueIdentifier, familyId)
    .input("reason", sql.NVarChar(50), reason)
    .query(`
      UPDATE RefreshTokens
      SET RevokedAtUtc = GETUTCDATE(),
          RevokedReason = @reason,
          UpdatedAtUtc = GETUTCDATE()
      WHERE FamilyId = @familyId AND RevokedAtUtc IS NULL
    `);
}

module.exports = { insert, findByHash, revoke, revokeFamily };
