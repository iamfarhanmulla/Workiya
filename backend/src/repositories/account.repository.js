const { connectDb, sql } = require("../config/db");
const { companyFilter } = require("../services/tenantScope");
const logger = require("../utils/logger");

const ACCOUNT_COLUMNS = `
  a.Id, a.CompanyId, a.Name, a.PhoneNumber, a.Email, a.Address,
  a.City, a.State, a.Country, a.Latitude, a.Longitude, a.PhotoUrl, a.Notes,
  a.ExtraFields, a.IsActive, a.CreatedAtUtc, a.UpdatedAtUtc`;

// A rep sees an account only while they hold an active assignment to it.
const ASSIGNED_TO_ME = `EXISTS (
  SELECT 1 FROM AccountAssignments aa
  WHERE aa.AccountId = a.Id AND aa.IsDeleted = 0 AND aa.UserId = @me)`;

const SEARCH_CLAUSE = "(a.Name LIKE @search OR a.City LIKE @search"
  + " OR a.PhoneNumber LIKE @search OR a.Email LIKE @search)";

// Pool for a plain call, or the caller's transaction.
async function executor(db) {
  return db || connectDb();
}

function escapeLike(value) {
  return value.replace(/[[%_]/g, "[$&]");
}

// WHERE predicate for the rows a scope may see. scope = { user, companyId?, assignedUserId? }.
function scopeClause(request, scope) {
  const clauses = ["a.IsDeleted = 0", companyFilter(request, scope.user, "a.CompanyId")];
  if (scope.companyId) {
    request.input("filterCompanyId", sql.Int, scope.companyId);
    clauses.push("a.CompanyId = @filterCompanyId");
  }
  if (scope.assignedUserId) {
    request.input("me", sql.Int, scope.assignedUserId);
    clauses.push(ASSIGNED_TO_ME);
  }
  return clauses.join(" AND ");
}

function listClause(request, scope, filters) {
  const clauses = [scopeClause(request, scope)];
  if (filters.search) {
    request.input("search", sql.NVarChar(300), `%${escapeLike(filters.search)}%`);
    clauses.push(SEARCH_CLAUSE);
  }
  if (typeof filters.isActive === "boolean") {
    request.input("isActive", sql.Bit, filters.isActive);
    clauses.push("a.IsActive = @isActive");
  }
  return clauses.join(" AND ");
}

async function list(scope, filters) {
  const pool = await connectDb();
  const request = pool.request()
    .input("offset", sql.Int, (filters.page - 1) * filters.pageSize)
    .input("pageSize", sql.Int, filters.pageSize);
  const where = listClause(request, scope, filters);
  const result = await request.query(`
    SELECT COUNT(*) AS Total FROM Accounts a WHERE ${where};
    SELECT ${ACCOUNT_COLUMNS}
    FROM Accounts a
    WHERE ${where}
    ORDER BY a.Name, a.Id
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `);
  return { total: result.recordsets[0][0].Total, rows: result.recordsets[1] };
}

async function findById(id, scope, db) {
  const request = (await executor(db)).request().input("id", sql.Int, id);
  const where = scopeClause(request, scope);
  const result = await request.query(`
    SELECT ${ACCOUNT_COLUMNS}
    FROM Accounts a
    WHERE a.Id = @id AND ${where}
  `);
  return result.recordset[0] || null;
}

function serializeExtraFields(values) {
  return values && Object.keys(values).length > 0 ? JSON.stringify(values) : null;
}

// Binds the profile columns shared by insert and update.
function bindFields(request, fields) {
  return request
    .input("name", sql.NVarChar(200), fields.name)
    .input("phoneNumber", sql.NVarChar(30), fields.phoneNumber)
    .input("email", sql.NVarChar(255), fields.email)
    .input("address", sql.NVarChar(500), fields.address)
    .input("city", sql.NVarChar(100), fields.city)
    .input("state", sql.NVarChar(100), fields.state)
    .input("country", sql.NVarChar(100), fields.country)
    .input("latitude", sql.Decimal(10, 7), fields.latitude)
    .input("longitude", sql.Decimal(10, 7), fields.longitude)
    .input("photoUrl", sql.NVarChar(500), fields.photoUrl)
    .input("notes", sql.NVarChar(1000), fields.notes)
    .input("extraFields", sql.NVarChar(sql.MAX), serializeExtraFields(fields.extraFields));
}

async function insert(companyId, fields, userId) {
  const pool = await connectDb();
  const request = pool.request()
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId);
  const result = await bindFields(request, fields).query(`
    INSERT INTO Accounts
      (CompanyId, Name, PhoneNumber, Email, Address, City, State, Country,
       Latitude, Longitude, PhotoUrl, Notes, ExtraFields,
       IsActive, IsDeleted, CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy)
    OUTPUT INSERTED.Id
    VALUES
      (@companyId, @name, @phoneNumber, @email, @address, @city, @state, @country,
       @latitude, @longitude, @photoUrl, @notes, @extraFields,
       1, 0, GETUTCDATE(), @userId, GETUTCDATE(), @userId)
  `);
  return result.recordset[0].Id;
}

function targetRequest(pool, id, companyId, userId) {
  return pool.request()
    .input("id", sql.Int, id)
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId);
}

const TARGET = "WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0";

async function update(id, companyId, fields, userId) {
  const pool = await connectDb();
  const request = bindFields(targetRequest(pool, id, companyId, userId), fields);
  const result = await request.query(`
    UPDATE Accounts SET
      Name = @name, PhoneNumber = @phoneNumber, Email = @email, Address = @address,
      City = @city, State = @state, Country = @country,
      Latitude = @latitude, Longitude = @longitude, PhotoUrl = @photoUrl,
      Notes = @notes, ExtraFields = @extraFields,
      UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
    ${TARGET}
  `);
  return result.rowsAffected[0];
}

async function setStatus(id, companyId, isActive, userId) {
  const pool = await connectDb();
  const result = await targetRequest(pool, id, companyId, userId)
    .input("isActive", sql.Bit, isActive)
    .query(`
      UPDATE Accounts SET IsActive = @isActive, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      ${TARGET}
    `);
  return result.rowsAffected[0];
}

async function softDelete(id, companyId, userId, db) {
  const result = await targetRequest(await executor(db), id, companyId, userId).query(`
    UPDATE Accounts SET
      IsDeleted = 1, IsActive = 0, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
    ${TARGET}
  `);
  return result.rowsAffected[0];
}

// Runs work(transaction) in one mssql transaction: commit on success, roll back on error.
async function withTransaction(work) {
  const pool = await connectDb();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.warn({ err: rollbackErr }, "Transaction rollback failed");
    }
    throw err;
  }
}

module.exports = {
  list, findById, insert, update, setStatus, softDelete, withTransaction,
};
