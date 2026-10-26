const db = require("../config/db");
const { ROLES } = require("../constants/roles");
const { companyFilter } = require("../services/tenantScope");
const { toFlag } = require("./sqlValues");

// The legacy Companies screen reads PascalCase keys, so columns are aliased back to them.
const COMPANY_COLUMNS = `
  c.id AS "Id", c.name AS "Name", c.key AS "Key", c.logo_url AS "LogoUrl",
  c.contact_email AS "ContactEmail", c.contact_phone AS "ContactPhone",
  c.address AS "Address", c.city AS "City", c.country AS "Country", c.plan AS "Plan",
  c.status AS "Status", c.is_active AS "IsActive", c.created_at AS "CreatedAtUtc"`;

const COUNT_COLUMNS = `
  (SELECT count(*) FROM users u
    WHERE u.company_id = c.id AND NOT u.is_deleted) AS "TotalUsers",
  (SELECT count(*) FROM users u
    WHERE u.company_id = c.id AND NOT u.is_deleted
      AND u.role_id IN (SELECT id FROM roles WHERE code = @employeeCode)) AS "EmployeeCount",
  (SELECT count(*) FROM users u
    WHERE u.company_id = c.id AND NOT u.is_deleted
      AND u.role_id IN (SELECT id FROM roles WHERE code = @managerCode)) AS "ManagerCount"`;

const COUNT_PARAMS = Object.freeze({ employeeCode: ROLES.EMPLOYEE, managerCode: ROLES.MANAGER });

async function list() {
  const { rows } = await db.query(`
    SELECT ${COMPANY_COLUMNS}, c.updated_at AS "UpdatedAtUtc", ${COUNT_COLUMNS}
    FROM companies c
    WHERE NOT c.is_deleted
    ORDER BY c.created_at DESC`, { ...COUNT_PARAMS });
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(`
    SELECT ${COMPANY_COLUMNS}, ${COUNT_COLUMNS}
    FROM companies c
    WHERE c.id = @id AND NOT c.is_deleted`, { ...COUNT_PARAMS, id });
  return rows[0] || null;
}

// Active companies for dropdowns; anyone but a SUPER_ADMIN sees only their own company.
async function listOptions(actor) {
  const params = {};
  const scope = companyFilter(actor, "id", params);
  const { rows } = await db.query(`
    SELECT id AS "Id", name AS "Name", key AS "Key", city AS "City", country AS "Country",
      plan AS "Plan"
    FROM companies
    WHERE is_active AND NOT is_deleted AND ${scope}
    ORDER BY name`, params);
  return rows;
}

async function keyInUse(key) {
  const { rowCount } = await db.query(
    "SELECT id FROM companies WHERE key = @key AND NOT is_deleted",
    { key },
  );
  return rowCount > 0;
}

async function exists(id) {
  const { rowCount } = await db.query(
    "SELECT id FROM companies WHERE id = @id AND NOT is_deleted",
    { id },
  );
  return rowCount > 0;
}

// New companies start active (status 1). Returns the new id.
async function insert(fields) {
  const { rows } = await db.query(`
    INSERT INTO companies
      (name, key, logo_url, contact_email, contact_phone, address, city, country, plan,
       status, is_active, created_by, updated_by)
    VALUES
      (@name, @key, @logoUrl, @contactEmail, @contactPhone, @address, @city, @country, @plan,
       1, true, @actorId, @actorId)
    RETURNING id
  `, fields);
  return rows[0].id;
}

async function update(id, fields) {
  await db.query(`
    UPDATE companies SET
      name = @name,
      key = @key,
      logo_url = @logoUrl,
      contact_email = @contactEmail,
      contact_phone = @contactPhone,
      address = @address,
      city = @city,
      country = @country,
      plan = @plan,
      is_active = @isActive,
      updated_at = now(),
      updated_by = @actorId
    WHERE id = @id
  `, { ...fields, isActive: toFlag(fields.isActive), id });
}

async function setActive(id, isActive, actorId) {
  await db.query(`
    UPDATE companies SET is_active = @isActive, updated_at = now(), updated_by = @actorId
    WHERE id = @id AND NOT is_deleted
  `, { id, isActive: toFlag(isActive, false), actorId });
}

async function softDelete(id, actorId) {
  await db.query(`
    UPDATE companies SET is_deleted = true, is_active = false,
      updated_at = now(), updated_by = @actorId
    WHERE id = @id
  `, { id, actorId });
}

module.exports = {
  list, findById, listOptions, keyInUse, exists, insert, update, setActive, softDelete,
};
