const db = require("../config/db");
const { ROLES } = require("../constants/roles");
const {
  companyFilter, manageableUserFilter, roleFilter,
} = require("../services/tenantScope");
const { toFlag } = require("./sqlValues");

// The legacy admin screens (users, employees, managers) read PascalCase keys, so every column
// is aliased back to the name the frontend used before the move to PostgreSQL.
const KINDS = Object.freeze({ USER: "user", EMPLOYEE: "employee", MANAGER: "manager" });

// Bound to every list / detail query; only the employee query references it.
const SELECT_PARAMS = Object.freeze({ completedStatus: "Completed" });

const PERSON_COLUMNS = `
  u.first_name AS "FirstName", u.middle_name AS "MiddleName", u.last_name AS "LastName",
  u.display_name AS "DisplayName", u.email AS "Email", u.phone_number AS "PhoneNumber",
  u.profile_photo_url AS "ProfilePhotoUrl"`;
const COMPANY_COLUMNS = 'u.company_id AS "CompanyId", c.name AS "CompanyName"';
const ROLE_COLUMNS = 'u.role_id AS "RoleId", r.name AS "RoleName"';
const MANAGER_COLUMNS = `u.manager_id AS "ManagerId",
  concat(m.first_name, ' ', m.last_name) AS "ManagerName"`;
const STATE_COLUMNS = `u.status AS "Status", u.is_active AS "IsActive",
  u.created_at AS "CreatedAtUtc", u.updated_at AS "UpdatedAtUtc"`;

const BASE_FROM = `
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN roles r ON r.id = u.role_id`;
const MANAGER_JOIN = "LEFT JOIN users m ON m.id = u.manager_id";

// Task counts come from activities (the old Tasks rows were copied there).
const SELECTS = Object.freeze({
  [KINDS.USER]: `SELECT u.id AS "Id", ${COMPANY_COLUMNS}, ${ROLE_COLUMNS}, ${MANAGER_COLUMNS},
    u.username AS "Username", u.email AS "Email", u.first_name AS "FirstName",
    u.middle_name AS "MiddleName", u.last_name AS "LastName",
    u.display_name AS "DisplayName", u.phone_number AS "PhoneNumber",
    u.profile_photo_url AS "ProfilePhotoUrl", u.status AS "Status", u.is_active AS "IsActive",
    u.is_deleted AS "IsDeleted", u.created_at AS "CreatedAtUtc", u.updated_at AS "UpdatedAtUtc"
    ${BASE_FROM} ${MANAGER_JOIN}`,
  [KINDS.EMPLOYEE]: `SELECT u.id AS "Id", ${PERSON_COLUMNS}, ${COMPANY_COLUMNS},
    ${ROLE_COLUMNS}, ${MANAGER_COLUMNS}, ${STATE_COLUMNS},
    (SELECT count(*) FROM activities a
      WHERE a.assigned_to = u.id AND NOT a.is_deleted) AS "TaskCount",
    (SELECT count(*) FROM activities a
      WHERE a.assigned_to = u.id AND a.status = @completedStatus AND NOT a.is_deleted)
      AS "TaskDone"
    ${BASE_FROM} ${MANAGER_JOIN}`,
  [KINDS.MANAGER]: `SELECT u.id AS "Id", ${PERSON_COLUMNS}, ${COMPANY_COLUMNS},
    ${ROLE_COLUMNS}, ${STATE_COLUMNS},
    (SELECT count(*) FROM users e
      WHERE e.manager_id = u.id AND NOT e.is_deleted) AS "EmployeeCount",
    (SELECT count(*) FROM activities a
      WHERE a.assigned_by = u.id AND NOT a.is_deleted) AS "TaskCount"
    ${BASE_FROM}`,
});

// Columns each screen may change: [column, parameter name in `values`].
const UPDATE_COLUMNS = Object.freeze({
  [KINDS.USER]: [
    ["company_id", "companyId"], ["role_id", "roleId"], ["manager_id", "managerId"],
    ["username", "username"], ["email", "email"], ["first_name", "firstName"],
    ["middle_name", "middleName"], ["last_name", "lastName"], ["display_name", "displayName"],
    ["phone_number", "phoneNumber"], ["is_active", "isActive"],
  ],
  [KINDS.EMPLOYEE]: [
    ["first_name", "firstName"], ["middle_name", "middleName"], ["last_name", "lastName"],
    ["display_name", "displayName"], ["email", "email"], ["phone_number", "phoneNumber"],
    ["company_id", "companyId"], ["manager_id", "managerId"], ["is_active", "isActive"],
  ],
  [KINDS.MANAGER]: [
    ["first_name", "firstName"], ["middle_name", "middleName"], ["last_name", "lastName"],
    ["display_name", "displayName"], ["email", "email"], ["phone_number", "phoneNumber"],
    ["company_id", "companyId"], ["is_active", "isActive"],
  ],
});

// users.company_id is NOT NULL: a SUPER_ADMIN who leaves Company empty keeps the current one.
const KEEP_WHEN_NULL = new Set(["company_id"]);

function setClause(column, name) {
  return KEEP_WHEN_NULL.has(column)
    ? `${column} = COALESCE(@${name}, ${column})`
    : `${column} = @${name}`;
}

const KIND_ROLES = Object.freeze({
  [KINDS.EMPLOYEE]: ROLES.EMPLOYEE,
  [KINDS.MANAGER]: ROLES.MANAGER,
});

// The rows of `kind` the actor may see or change. Users: the actor's company, never a
// SUPER_ADMIN. Employees / managers: that role, in the actor's company.
function scopeFor(kind, actor, params, prefix = "") {
  if (kind === KINDS.USER) {
    return manageableUserFilter(actor, params, prefix);
  }
  const role = roleFilter(KIND_ROLES[kind], params, prefix);
  return `${role} AND ${companyFilter(actor, `${prefix}company_id`, params)}`;
}

async function list(kind, actor) {
  const params = { ...SELECT_PARAMS };
  const scope = scopeFor(kind, actor, params, "u.");
  const { rows } = await db.query(`${SELECTS[kind]}
    WHERE NOT u.is_deleted AND ${scope}
    ORDER BY u.created_at DESC`, params);
  return rows;
}

async function findById(kind, actor, id) {
  const params = { ...SELECT_PARAMS, id };
  const scope = scopeFor(kind, actor, params, "u.");
  const { rows } = await db.query(`${SELECTS[kind]}
    WHERE u.id = @id AND NOT u.is_deleted AND ${scope}`, params);
  return rows[0] || null;
}

async function existsInScope(kind, actor, id) {
  const params = { id };
  const scope = scopeFor(kind, actor, params);
  const { rowCount } = await db.query(
    `SELECT id FROM users WHERE id = @id AND NOT is_deleted AND ${scope}`,
    params,
  );
  return rowCount > 0;
}

// Any user row, deleted or not, in any company (citext: case-insensitive).
async function emailInUse(email) {
  const { rowCount } = await db.query(
    "SELECT 1 FROM users WHERE email = @email LIMIT 1",
    { email },
  );
  return rowCount > 0;
}

async function roleCodeOf(roleId) {
  const { rows } = await db.query("SELECT code FROM roles WHERE id = @roleId", { roleId });
  return rows[0] ? rows[0].code : null;
}

async function roleIdByCode(code) {
  const { rows } = await db.query(
    "SELECT id FROM roles WHERE code = @code AND NOT is_deleted",
    { code },
  );
  return rows[0] ? rows[0].id : null;
}

// New accounts start active (status 1). Empty optional form values are stored as NULL.
// Returns the new id.
async function insert(fields) {
  const params = {
    companyId: fields.companyId ?? null,
    roleId: fields.roleId ?? null,
    managerId: fields.managerId || null,
    username: fields.username || null,
    email: fields.email,
    passwordHash: fields.passwordHash,
    passwordSalt: fields.passwordSalt,
    passwordIterations: fields.passwordIterations,
    firstName: fields.firstName || null,
    middleName: fields.middleName || null,
    lastName: fields.lastName || null,
    displayName: fields.displayName || null,
    phoneNumber: fields.phoneNumber || null,
    createdBy: fields.createdBy ?? null,
  };
  const { rows } = await db.query(`
    INSERT INTO users
      (company_id, role_id, manager_id, username, email,
       password_hash, password_salt, password_iterations,
       first_name, middle_name, last_name, display_name, phone_number,
       status, is_active, created_by, updated_by)
    VALUES
      (@companyId, @roleId, @managerId, @username, @email,
       @passwordHash, @passwordSalt, @passwordIterations,
       @firstName, @middleName, @lastName, @displayName, @phoneNumber,
       1, true, @createdBy, @createdBy)
    RETURNING id
  `, params);
  return rows[0].id;
}

// Only the columns of `kind` are written; missing values become NULL, as before, except
// isActive, which defaults to active, and company_id, which is kept.
async function update(kind, actor, id, values) {
  const params = { id, updatedBy: actor.id };
  const sets = UPDATE_COLUMNS[kind].map(([column, name]) => {
    params[name] = name === "isActive" ? toFlag(values.isActive) : values[name] ?? null;
    return setClause(column, name);
  });
  const scope = scopeFor(kind, actor, params);
  const { rowCount } = await db.query(`
    UPDATE users SET ${sets.join(", ")}, updated_at = now(), updated_by = @updatedBy
    WHERE id = @id AND NOT is_deleted AND ${scope}`, params);
  return rowCount > 0;
}

async function setActive(kind, actor, id, isActive) {
  const params = { id, isActive: toFlag(isActive, false), updatedBy: actor.id };
  const scope = scopeFor(kind, actor, params);
  const { rowCount } = await db.query(`
    UPDATE users SET is_active = @isActive, updated_at = now(), updated_by = @updatedBy
    WHERE id = @id AND NOT is_deleted AND ${scope}`, params);
  return rowCount > 0;
}

async function softDelete(kind, actor, id) {
  const params = { id, updatedBy: actor.id };
  const scope = scopeFor(kind, actor, params);
  const { rowCount } = await db.query(`
    UPDATE users SET is_deleted = true, is_active = false,
      deleted_at = now(), deleted_by = @updatedBy, updated_at = now(), updated_by = @updatedBy
    WHERE id = @id AND NOT is_deleted AND ${scope}`, params);
  return rowCount > 0;
}

async function listRoles() {
  const { rows } = await db.query(`
    SELECT id AS "Id", name AS "Name", code AS "Code", description AS "Description"
    FROM roles WHERE is_active AND NOT is_deleted
    ORDER BY name`);
  return rows;
}

// Active managers for dropdowns, limited to the actor's company.
async function listManagerOptions(actor) {
  const params = {};
  const role = roleFilter(ROLES.MANAGER, params, "u.");
  const scope = companyFilter(actor, "u.company_id", params);
  const { rows } = await db.query(`
    SELECT u.id AS "Id", concat(u.first_name, ' ', u.last_name) AS "Name",
      u.company_id AS "CompanyId", c.name AS "CompanyName"
    FROM users u
    LEFT JOIN companies c ON c.id = u.company_id
    WHERE NOT u.is_deleted AND u.is_active AND ${role} AND ${scope}
    ORDER BY u.first_name`, params);
  return rows;
}

module.exports = {
  KINDS,
  list,
  findById,
  existsInScope,
  emailInUse,
  roleCodeOf,
  roleIdByCode,
  insert,
  update,
  setActive,
  softDelete,
  listRoles,
  listManagerOptions,
};
