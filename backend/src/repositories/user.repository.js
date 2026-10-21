const { connectDb, sql } = require("../config/db");

const PROFILE_COLUMNS = `
  u.Id, u.CompanyId, u.RoleId, r.Code AS RoleCode, r.Name AS RoleName,
  u.Username, u.Email, u.DisplayName, u.FirstName, u.MiddleName, u.LastName,
  u.PhoneNumber, u.Status`;

const ACTIVE_USER_FILTER = "u.IsActive = 1 AND u.IsDeleted = 0";

async function findActiveByEmail(email) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("email", sql.NVarChar(320), email)
    .query(`
      SELECT ${PROFILE_COLUMNS},
        u.PasswordHash, u.PasswordSalt, u.PasswordIterations,
        u.FailedLoginCount, u.LockoutEndUtc
      FROM Users u
      LEFT JOIN Roles r ON r.Id = u.RoleId AND r.IsDeleted = 0
      WHERE u.Email = @email AND ${ACTIVE_USER_FILTER}
    `);
  return result.recordset[0] || null;
}

async function findActiveById(id) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      SELECT ${PROFILE_COLUMNS}
      FROM Users u
      LEFT JOIN Roles r ON r.Id = u.RoleId AND r.IsDeleted = 0
      WHERE u.Id = @id AND ${ACTIVE_USER_FILTER}
    `);
  return result.recordset[0] || null;
}

// The count and the lock decision are made in one UPDATE on the locked row, so parallel
// wrong-password requests cannot all read the same stale count and skip the lockout.
const NEXT_FAILED_COUNT = `CASE
  WHEN LockoutEndUtc IS NOT NULL AND LockoutEndUtc <= GETUTCDATE() THEN 1
  ELSE ISNULL(FailedLoginCount, 0) + 1
END`;

async function recordFailedLogin(id, { maxFailedLogins, lockoutMinutes }) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("maxFailedLogins", sql.Int, maxFailedLogins)
    .input("lockoutMinutes", sql.Int, lockoutMinutes)
    .query(`
      UPDATE Users
      SET FailedLoginCount = ${NEXT_FAILED_COUNT},
          LockoutEndUtc = CASE
            WHEN ${NEXT_FAILED_COUNT}
              >= @maxFailedLogins THEN DATEADD(minute, @lockoutMinutes, GETUTCDATE())
            WHEN LockoutEndUtc <= GETUTCDATE() THEN NULL
            ELSE LockoutEndUtc
          END,
          LastFailedLoginUtc = GETUTCDATE()
      OUTPUT inserted.FailedLoginCount, inserted.LockoutEndUtc
      WHERE Id = @id
    `);
  const row = result.recordset[0];
  return {
    failedLoginCount: row ? row.FailedLoginCount : 0,
    lockoutEndUtc: row && row.LockoutEndUtc ? new Date(row.LockoutEndUtc) : null,
  };
}

async function recordSuccessfulLogin(id) {
  const pool = await connectDb();
  await pool
    .request()
    .input("id", sql.Int, id)
    .query(`
      UPDATE Users
      SET FailedLoginCount = 0,
          LockoutEndUtc = NULL,
          LastLoginUtc = GETUTCDATE()
      WHERE Id = @id
    `);
}

async function updatePasswordHash(id, { passwordHash, passwordSalt, passwordIterations }) {
  const pool = await connectDb();
  await pool
    .request()
    .input("id", sql.Int, id)
    .input("passwordHash", sql.NVarChar(500), passwordHash)
    .input("passwordSalt", sql.NVarChar(200), passwordSalt)
    .input("passwordIterations", sql.Int, passwordIterations)
    .query(`
      UPDATE Users
      SET PasswordHash = @passwordHash,
          PasswordSalt = @passwordSalt,
          PasswordIterations = @passwordIterations,
          UpdatedAtUtc = GETUTCDATE(),
          UpdatedBy = @id
      WHERE Id = @id
    `);
}

module.exports = {
  findActiveByEmail,
  findActiveById,
  recordFailedLogin,
  recordSuccessfulLogin,
  updatePasswordHash,
};
