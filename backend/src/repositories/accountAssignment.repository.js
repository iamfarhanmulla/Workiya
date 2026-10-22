const { connectDb, sql } = require("../config/db");
const { ROLES } = require("../constants/roles");

// SQL Server accepts at most 2100 parameters per request; stay well below it.
const INSERT_CHUNK = 500;
const ID_CHUNK = 1000;

const DISPLAY_NAME = "COALESCE(NULLIF(LTRIM(RTRIM(u.DisplayName)), ''),"
  + " LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))))";

async function executor(db) {
  return db || connectDb();
}

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Binds each id as its own parameter and returns the "@p0, @p1, ..." placeholder list.
function bindIds(request, prefix, ids) {
  return ids.map((id, i) => {
    request.input(`${prefix}${i}`, sql.Int, id);
    return `@${prefix}${i}`;
  }).join(", ");
}

// Active assignments, with the rep's name and role, for a page of accounts in one query.
async function listByAccountIds(accountIds) {
  if (accountIds.length === 0) {
    return [];
  }
  const pool = await connectDb();
  const request = pool.request();
  const placeholders = bindIds(request, "account", accountIds);
  const result = await request.query(`
    SELECT aa.Id, aa.AccountId, aa.UserId, aa.VisitsPerMonth,
      ${DISPLAY_NAME} AS DisplayName, r.Code AS RoleCode
    FROM AccountAssignments aa
    JOIN Users u ON u.Id = aa.UserId
    LEFT JOIN Roles r ON r.Id = u.RoleId AND r.IsDeleted = 0
    WHERE aa.IsDeleted = 0 AND aa.AccountId IN (${placeholders})
    ORDER BY DisplayName, aa.UserId
  `);
  return result.recordset;
}

// Locks one account's active assignments for the rest of the transaction.
async function lockActiveForAccount(accountId, db) {
  const result = await (await executor(db)).request()
    .input("accountId", sql.Int, accountId)
    .query(`
      SELECT Id, AccountId, UserId, VisitsPerMonth
      FROM AccountAssignments WITH (UPDLOCK, HOLDLOCK)
      WHERE AccountId = @accountId AND IsDeleted = 0
    `);
  return result.recordset;
}

// Locks a user's active assignments to live accounts of one company.
async function lockActiveForUser(companyId, userId, db) {
  const result = await (await executor(db)).request()
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId)
    .query(`
      SELECT aa.Id, aa.AccountId, aa.UserId, aa.VisitsPerMonth
      FROM AccountAssignments aa WITH (UPDLOCK, HOLDLOCK)
      JOIN Accounts a ON a.Id = aa.AccountId AND a.IsDeleted = 0
      WHERE aa.CompanyId = @companyId AND aa.UserId = @userId AND aa.IsDeleted = 0
    `);
  return result.recordset;
}

async function insertChunk(pool, companyId, rows, createdBy) {
  const request = pool.request()
    .input("companyId", sql.Int, companyId)
    .input("createdBy", sql.Int, createdBy);
  const values = rows.map((row, i) => {
    request
      .input(`account${i}`, sql.Int, row.accountId)
      .input(`user${i}`, sql.Int, row.userId)
      .input(`visits${i}`, sql.TinyInt, row.visitsPerMonth ?? null);
    return `(@companyId, @account${i}, @user${i}, @visits${i},`
      + " GETUTCDATE(), @createdBy, GETUTCDATE(), @createdBy, 0)";
  });
  await request.query(`
    INSERT INTO AccountAssignments
      (CompanyId, AccountId, UserId, VisitsPerMonth,
       CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy, IsDeleted)
    VALUES ${values.join(",\n      ")}
  `);
}

// rows = [{ accountId, userId, visitsPerMonth }]
async function insertMany(companyId, rows, createdBy, db) {
  const pool = await executor(db);
  await chunk(rows, INSERT_CHUNK).reduce(
    (previous, part) => previous.then(() => insertChunk(pool, companyId, part, createdBy)),
    Promise.resolve(),
  );
}

async function softDeleteChunk(pool, ids, updatedBy) {
  const request = pool.request().input("updatedBy", sql.Int, updatedBy);
  const placeholders = bindIds(request, "id", ids);
  await request.query(`
    UPDATE AccountAssignments
    SET IsDeleted = 1, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @updatedBy
    WHERE IsDeleted = 0 AND Id IN (${placeholders})
  `);
}

async function softDeleteByIds(ids, updatedBy, db) {
  const pool = await executor(db);
  await chunk(ids, ID_CHUNK).reduce(
    (previous, part) => previous.then(() => softDeleteChunk(pool, part, updatedBy)),
    Promise.resolve(),
  );
}

async function updateVisits(id, visitsPerMonth, updatedBy, db) {
  await (await executor(db)).request()
    .input("id", sql.Int, id)
    .input("visitsPerMonth", sql.TinyInt, visitsPerMonth)
    .input("updatedBy", sql.Int, updatedBy)
    .query(`
      UPDATE AccountAssignments
      SET VisitsPerMonth = @visitsPerMonth, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @updatedBy
      WHERE Id = @id AND IsDeleted = 0
    `);
}

async function softDeleteForAccount(accountId, updatedBy, db) {
  await (await executor(db)).request()
    .input("accountId", sql.Int, accountId)
    .input("updatedBy", sql.Int, updatedBy)
    .query(`
      UPDATE AccountAssignments
      SET IsDeleted = 1, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @updatedBy
      WHERE AccountId = @accountId AND IsDeleted = 0
    `);
}

// The ids, out of userIds, of active reps (EMPLOYEE or MANAGER) of one company.
async function findAssignableUserIds(companyId, userIds) {
  if (userIds.length === 0) {
    return [];
  }
  const pool = await connectDb();
  const request = pool.request()
    .input("companyId", sql.Int, companyId)
    .input("employeeCode", sql.NVarChar(50), ROLES.EMPLOYEE)
    .input("managerCode", sql.NVarChar(50), ROLES.MANAGER);
  const placeholders = bindIds(request, "user", userIds);
  const result = await request.query(`
    SELECT u.Id
    FROM Users u
    JOIN Roles r ON r.Id = u.RoleId AND r.IsDeleted = 0
    WHERE u.Id IN (${placeholders})
      AND u.CompanyId = @companyId AND u.IsActive = 1 AND u.IsDeleted = 0
      AND r.Code IN (@employeeCode, @managerCode)
  `);
  return result.recordset.map((row) => row.Id);
}

// Whether a user (in any state: a leaving rep may already be deactivated) belongs to a company.
async function isCompanyUser(companyId, userId) {
  const pool = await connectDb();
  const result = await pool.request()
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId)
    .query("SELECT Id FROM Users WHERE Id = @userId AND CompanyId = @companyId");
  return result.recordset.length > 0;
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
