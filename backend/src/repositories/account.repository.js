const db = require("../config/db");
const { companyFilter } = require("../services/tenantScope");

const ACCOUNT_COLUMNS = `
  a.id, a.company_id, a.name, a.phone_number, a.email, a.address,
  a.city, a.state, a.country, a.latitude, a.longitude, a.photo_url, a.notes,
  a.extra_fields, a.is_active, a.created_at, a.updated_at`;

// A rep sees an account only while they hold an active assignment to it.
const ASSIGNED_TO_ME = `EXISTS (
  SELECT 1 FROM account_assignments aa
  WHERE aa.account_id = a.id AND NOT aa.is_deleted AND aa.user_id = @me)`;

// Case-insensitive, like the SQL Server collation the API was built on.
const SEARCH_CLAUSE = "(a.name ILIKE @search OR a.city ILIKE @search"
  + " OR a.phone_number ILIKE @search OR a.email ILIKE @search)";

const TARGET = "WHERE id = @id AND company_id = @companyId AND NOT is_deleted";

// Escapes LIKE wildcards; backslash is PostgreSQL's default LIKE escape character.
function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// WHERE predicate for the rows a scope may see; adds its values to params.
// scope = { user, companyId?, assignedUserId? }.
function scopeClause(params, scope) {
  const clauses = ["NOT a.is_deleted", companyFilter(scope.user, "a.company_id", params)];
  if (scope.companyId) {
    Object.assign(params, { filterCompanyId: scope.companyId });
    clauses.push("a.company_id = @filterCompanyId");
  }
  if (scope.assignedUserId) {
    Object.assign(params, { me: scope.assignedUserId });
    clauses.push(ASSIGNED_TO_ME);
  }
  return clauses.join(" AND ");
}

function listClause(params, scope, filters) {
  const clauses = [scopeClause(params, scope)];
  if (filters.search) {
    Object.assign(params, { search: `%${escapeLike(filters.search)}%` });
    clauses.push(SEARCH_CLAUSE);
  }
  if (typeof filters.isActive === "boolean") {
    Object.assign(params, { isActive: filters.isActive });
    clauses.push("a.is_active = @isActive");
  }
  return clauses.join(" AND ");
}

async function list(scope, filters) {
  const params = {
    offset: (filters.page - 1) * filters.pageSize,
    pageSize: filters.pageSize,
  };
  const where = listClause(params, scope, filters);
  const [count, page] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total FROM accounts a WHERE ${where}`, params),
    db.query(
      `SELECT ${ACCOUNT_COLUMNS}
       FROM accounts a
       WHERE ${where}
       ORDER BY a.name, a.id
       LIMIT @pageSize OFFSET @offset`,
      params,
    ),
  ]);
  return { total: count.rows[0].total, rows: page.rows };
}

// tx: the caller's transaction (withTransaction), or the pool when omitted.
async function findById(id, scope, tx = db) {
  const params = { id };
  const where = scopeClause(params, scope);
  const { rows } = await tx.query(
    `SELECT ${ACCOUNT_COLUMNS}
     FROM accounts a
     WHERE a.id = @id AND ${where}`,
    params,
  );
  return rows[0] || null;
}

// Values of the profile columns shared by insert and update. extra_fields is jsonb: the
// object is sent as JSON, and an empty set of values is stored as NULL.
function fieldParams(fields) {
  const extra = fields.extraFields;
  return {
    name: fields.name,
    phoneNumber: fields.phoneNumber,
    email: fields.email,
    address: fields.address,
    city: fields.city,
    state: fields.state,
    country: fields.country,
    latitude: fields.latitude,
    longitude: fields.longitude,
    photoUrl: fields.photoUrl,
    notes: fields.notes,
    extraFields: extra && Object.keys(extra).length > 0 ? extra : null,
  };
}

async function insert(companyId, fields, userId) {
  const { rows } = await db.query(
    `INSERT INTO accounts
       (company_id, name, phone_number, email, address, city, state, country,
        latitude, longitude, photo_url, notes, extra_fields, created_by, updated_by)
     VALUES
       (@companyId, @name, @phoneNumber, @email, @address, @city, @state, @country,
        @latitude, @longitude, @photoUrl, @notes, @extraFields, @userId, @userId)
     RETURNING id`,
    { ...fieldParams(fields), companyId, userId },
  );
  return rows[0].id;
}

async function update(id, companyId, fields, userId) {
  const { rowCount } = await db.query(
    `UPDATE accounts SET
       name = @name, phone_number = @phoneNumber, email = @email, address = @address,
       city = @city, state = @state, country = @country,
       latitude = @latitude, longitude = @longitude, photo_url = @photoUrl,
       notes = @notes, extra_fields = @extraFields,
       updated_at = now(), updated_by = @userId
     ${TARGET}`,
    {
      ...fieldParams(fields), id, companyId, userId,
    },
  );
  return rowCount;
}

async function setStatus(id, companyId, isActive, userId) {
  const { rowCount } = await db.query(
    `UPDATE accounts SET is_active = @isActive, updated_at = now(), updated_by = @userId
     ${TARGET}`,
    {
      id, companyId, isActive, userId,
    },
  );
  return rowCount;
}

async function softDelete(id, companyId, userId, tx = db) {
  const { rowCount } = await tx.query(
    `UPDATE accounts SET
       is_deleted = true, is_active = false, updated_at = now(), updated_by = @userId
     ${TARGET}`,
    { id, companyId, userId },
  );
  return rowCount;
}

// Runs work(tx) in one transaction: commit on success, roll back on error (config/db).
function withTransaction(work) {
  return db.withTransaction(work);
}

module.exports = {
  list, findById, insert, update, setStatus, softDelete, withTransaction,
};
