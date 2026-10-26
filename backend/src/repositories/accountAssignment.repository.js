const db = require("../config/db");
const { ROLES } = require("../constants/roles");

const DISPLAY_NAME = "COALESCE(NULLIF(TRIM(u.display_name), ''),"
  + " TRIM(CONCAT(u.first_name, ' ', u.last_name)))";

// Active assignments, with the rep's name and role, for a page of accounts in one query.
async function listByAccountIds(accountIds) {
  if (accountIds.length === 0) {
    return [];
  }
  const { rows } = await db.query(
    `SELECT aa.id, aa.account_id, aa.user_id, aa.visits_per_month,
       ${DISPLAY_NAME} AS display_name, r.code AS role_code
     FROM account_assignments aa
     JOIN users u ON u.id = aa.user_id
     LEFT JOIN roles r ON r.id = u.role_id AND NOT r.is_deleted
     WHERE NOT aa.is_deleted AND aa.account_id = ANY(@accountIds::int[])
     ORDER BY ${DISPLAY_NAME}, aa.user_id`,
    { accountIds },
  );
  return rows;
}

// Locks one account's active assignments for the rest of the transaction. The account row is
// locked first, so two changes to the same account (even one with no assignments yet) run one
// after another; FOR NO KEY UPDATE still lets other transactions reference the account.
async function lockActiveForAccount(accountId, tx = db) {
  await tx.query("SELECT id FROM accounts WHERE id = @accountId FOR NO KEY UPDATE", { accountId });
  const { rows } = await tx.query(
    `SELECT id, account_id, user_id, visits_per_month
     FROM account_assignments
     WHERE account_id = @accountId AND NOT is_deleted
     FOR UPDATE`,
    { accountId },
  );
  return rows;
}

// Locks a user's active assignments to live accounts of one company.
async function lockActiveForUser(companyId, userId, tx = db) {
  const { rows } = await tx.query(
    `SELECT aa.id, aa.account_id, aa.user_id, aa.visits_per_month
     FROM account_assignments aa
     JOIN accounts a ON a.id = aa.account_id AND NOT a.is_deleted
     WHERE aa.company_id = @companyId AND aa.user_id = @userId AND NOT aa.is_deleted
     FOR UPDATE OF aa`,
    { companyId, userId },
  );
  return rows;
}

// rows = [{ accountId, userId, visitsPerMonth }], inserted in one statement from arrays.
async function insertMany(companyId, rows, createdBy, tx = db) {
  if (rows.length === 0) {
    return;
  }
  await tx.query(
    `INSERT INTO account_assignments
       (company_id, account_id, user_id, visits_per_month, created_by, updated_by)
     SELECT @companyId, n.account_id, n.user_id, n.visits_per_month, @createdBy, @createdBy
     FROM unnest(@accountIds::int[], @userIds::int[], @visits::smallint[])
       AS n (account_id, user_id, visits_per_month)`,
    {
      companyId,
      createdBy,
      accountIds: rows.map((row) => row.accountId),
      userIds: rows.map((row) => row.userId),
      visits: rows.map((row) => row.visitsPerMonth ?? null),
    },
  );
}

async function softDeleteByIds(ids, updatedBy, tx = db) {
  if (ids.length === 0) {
    return;
  }
  await tx.query(
    `UPDATE account_assignments
     SET is_deleted = true, updated_at = now(), updated_by = @updatedBy
     WHERE NOT is_deleted AND id = ANY(@ids::int[])`,
    { ids, updatedBy },
  );
}

async function updateVisits(id, visitsPerMonth, updatedBy, tx = db) {
  await tx.query(
    `UPDATE account_assignments
     SET visits_per_month = @visitsPerMonth, updated_at = now(), updated_by = @updatedBy
     WHERE id = @id AND NOT is_deleted`,
    { id, visitsPerMonth, updatedBy },
  );
}

async function softDeleteForAccount(accountId, updatedBy, tx = db) {
  await tx.query(
    `UPDATE account_assignments
     SET is_deleted = true, updated_at = now(), updated_by = @updatedBy
     WHERE account_id = @accountId AND NOT is_deleted`,
    { accountId, updatedBy },
  );
}

// The ids, out of userIds, of active reps (EMPLOYEE or MANAGER) of one company.
async function findAssignableUserIds(companyId, userIds) {
  if (userIds.length === 0) {
    return [];
  }
  const { rows } = await db.query(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id AND NOT r.is_deleted
     WHERE u.id = ANY(@userIds::int[])
       AND u.company_id = @companyId AND u.is_active AND NOT u.is_deleted
       AND r.code IN (@employeeCode, @managerCode)`,
    {
      companyId, userIds, employeeCode: ROLES.EMPLOYEE, managerCode: ROLES.MANAGER,
    },
  );
  return rows.map((row) => row.id);
}

// Whether a user (in any state: a leaving rep may already be deactivated) belongs to a company.
async function isCompanyUser(companyId, userId) {
  const { rows } = await db.query(
    "SELECT id FROM users WHERE id = @userId AND company_id = @companyId",
    { companyId, userId },
  );
  return rows.length > 0;
}

module.exports = {
  listByAccountIds,
  lockActiveForAccount,
  lockActiveForUser,
  insertMany,
  softDeleteByIds,
  updateVisits,
  softDeleteForAccount,
  findAssignableUserIds,
  isCompanyUser,
};
