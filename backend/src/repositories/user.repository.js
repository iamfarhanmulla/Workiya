const db = require("../config/db");

const PROFILE_COLUMNS = `
  u.id, u.company_id, u.role_id, r.code AS role_code, r.name AS role_name,
  u.username, u.email, u.display_name, u.first_name, u.middle_name, u.last_name,
  u.phone_number, u.status`;

const ACTIVE_USER_FILTER = "u.is_active AND NOT u.is_deleted";

// users.email is citext, so the lookup is case-insensitive. Emails are unique per company
// only; the lowest id wins so the answer is stable.
async function findActiveByEmail(email) {
  const { rows } = await db.query(`
    SELECT ${PROFILE_COLUMNS},
      u.password_hash, u.password_salt, u.password_iterations,
      u.failed_login_count, u.lockout_end_at
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id AND NOT r.is_deleted
    WHERE u.email = @email AND ${ACTIVE_USER_FILTER}
    ORDER BY u.id
    LIMIT 1
  `, { email });
  return rows[0] || null;
}

async function findActiveById(id) {
  const { rows } = await db.query(`
    SELECT ${PROFILE_COLUMNS}
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id AND NOT r.is_deleted
    WHERE u.id = @id AND ${ACTIVE_USER_FILTER}
  `, { id });
  return rows[0] || null;
}

// The count and the lock decision are made in one UPDATE on the locked row, so parallel
// wrong-password requests cannot all read the same stale count and skip the lockout. Every
// SET expression reads the row as it was before the UPDATE.
const NEXT_FAILED_COUNT = `CASE
  WHEN lockout_end_at IS NOT NULL AND lockout_end_at <= now() THEN 1
  ELSE failed_login_count + 1
END`;

async function recordFailedLogin(id, { maxFailedLogins, lockoutMinutes }) {
  const { rows } = await db.query(`
    UPDATE users
    SET failed_login_count = ${NEXT_FAILED_COUNT},
        lockout_end_at = CASE
          WHEN ${NEXT_FAILED_COUNT} >= @maxFailedLogins::int
            THEN now() + make_interval(mins => @lockoutMinutes::int)
          WHEN lockout_end_at <= now() THEN NULL
          ELSE lockout_end_at
        END,
        last_failed_login_at = now()
    WHERE id = @id
    RETURNING failed_login_count, lockout_end_at
  `, { id, maxFailedLogins, lockoutMinutes });
  const row = rows[0];
  return {
    failedLoginCount: row ? row.failed_login_count : 0,
    lockoutEndUtc: row && row.lockout_end_at ? new Date(row.lockout_end_at) : null,
  };
}

async function recordSuccessfulLogin(id) {
  await db.query(`
    UPDATE users
    SET failed_login_count = 0,
        lockout_end_at = NULL,
        last_login_at = now()
    WHERE id = @id
  `, { id });
}

async function updatePasswordHash(id, { passwordHash, passwordSalt, passwordIterations }) {
  await db.query(`
    UPDATE users
    SET password_hash = @passwordHash,
        password_salt = @passwordSalt,
        password_iterations = @passwordIterations,
        updated_at = now(),
        updated_by = @id
    WHERE id = @id
  `, {
    id, passwordHash, passwordSalt, passwordIterations,
  });
}

module.exports = {
  findActiveByEmail,
  findActiveById,
  recordFailedLogin,
  recordSuccessfulLogin,
  updatePasswordHash,
};
