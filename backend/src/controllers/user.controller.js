const { connectDb, sql } = require("../config/db");
const { ROLES } = require("../constants/roles");
const passwordService = require("../services/password.service");
const {
  toId, isSuperAdmin, resolveCompanyId, companyFilter, manageableUserFilter
} = require("../services/tenantScope");
const logger = require("../utils/logger");

const ASSIGN_FORBIDDEN = { success: false, message: "You are not allowed to assign this role or company." };
const NOT_FOUND = { success: false, message: "User not found." };
const PASSWORD_RULE = `Password must be at least ${passwordService.MIN_PASSWORD_LENGTH} characters.`;

const USER_SELECT = `
  SELECT
    u.Id, u.CompanyId, c.Name AS CompanyName,
    u.RoleId, r.Name AS RoleName,
    u.ManagerId,
    CONCAT(m.FirstName, ' ', m.LastName) AS ManagerName,
    u.Username, u.Email, u.FirstName, u.MiddleName, u.LastName,
    u.DisplayName, u.PhoneNumber, u.ProfilePhotoUrl,
    u.Status, u.IsActive, u.IsDeleted, u.CreatedAtUtc, u.UpdatedAtUtc
  FROM Users u
  LEFT JOIN Companies c ON c.Id = u.CompanyId
  LEFT JOIN Roles r ON r.Id = u.RoleId
  LEFT JOIN Users m ON m.Id = u.ManagerId`;

// Only SUPER_ADMIN may grant the SUPER_ADMIN role.
async function canAssignRole(pool, user, roleId) {
  if (isSuperAdmin(user) || toId(roleId) === null) return true;
  const role = await pool
    .request()
    .input("roleId", sql.Int, roleId)
    .query("SELECT Code FROM Roles WHERE Id = @roleId");
  return role.recordset[0]?.Code !== ROLES.SUPER_ADMIN;
}

// GET /api/v1/users
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request();
    const scope = manageableUserFilter(request, req.user, "u.");
    const result = await request.query(`${USER_SELECT}
      WHERE u.IsDeleted = 0 AND ${scope}
      ORDER BY u.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "getAll users error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/users/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = manageableUserFilter(request, req.user, "u.");
    const result = await request.query(`${USER_SELECT}
      WHERE u.Id = @id AND u.IsDeleted = 0 AND ${scope}
    `);
    if (result.recordset.length === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error({ err }, "getById user error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

async function insertUser(pool, fields) {
  const { passwordHash, passwordSalt, passwordIterations } = passwordService.hashForSharedUsersTable(fields.password);
  const result = await pool
    .request()
    .input("companyId",           sql.Int,            fields.companyId)
    .input("roleId",              sql.Int,            fields.roleId)
    .input("managerId",           sql.Int,            fields.managerId   || null)
    .input("username",            sql.NVarChar,       fields.username    || null)
    .input("email",               sql.NVarChar,       fields.email)
    .input("passwordHash",        sql.NVarChar,       passwordHash)
    .input("passwordSalt",        sql.NVarChar,       passwordSalt)
    .input("passwordIterations",  sql.Int,            passwordIterations)
    .input("firstName",           sql.NVarChar,       fields.firstName   || null)
    .input("middleName",          sql.NVarChar,       fields.middleName  || null)
    .input("lastName",            sql.NVarChar,       fields.lastName    || null)
    .input("displayName",         sql.NVarChar,       fields.displayName || null)
    .input("phoneNumber",         sql.NVarChar,       fields.phoneNumber || null)
    .query(`
      INSERT INTO Users
        (CompanyId, RoleId, ManagerId, Username, Email,
         PasswordHash, PasswordSalt, PasswordIterations,
         FirstName, MiddleName, LastName, DisplayName, PhoneNumber,
         Status, IsActive, IsDeleted, CreatedAtUtc)
      OUTPUT INSERTED.Id
      VALUES
        (@companyId, @roleId, @managerId, @username, @email,
         @passwordHash, @passwordSalt, @passwordIterations,
         @firstName, @middleName, @lastName, @displayName, @phoneNumber,
         1, 1, 0, SYSDATETIMEOFFSET())
    `);
  return result.recordset[0].Id;
}

// POST /api/v1/users
async function create(req, res) {
  const { email, password, roleId } = req.body;
  if (!email || !password || !roleId) {
    return res.status(400).json({ success: false, message: "Email, password and roleId are required." });
  }
  if (!passwordService.isAcceptablePassword(password)) {
    return res.status(400).json({ success: false, message: PASSWORD_RULE });
  }
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);

  try {
    const pool = await connectDb();
    if (!(await canAssignRole(pool, req.user, roleId))) return res.status(403).json(ASSIGN_FORBIDDEN);

    const exists = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");
    if (exists.recordset.length > 0)
      return res.status(409).json({ success: false, message: "Email already in use." });

    const id = await insertUser(pool, { ...req.body, companyId: company.companyId });
    return res.status(201).json({ success: true, message: "User created.", id });
  } catch (err) {
    logger.error({ err }, "create user error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

async function userExistsInScope(pool, user, id) {
  const request = pool.request().input("id", sql.Int, id);
  const scope = manageableUserFilter(request, user);
  const result = await request.query(`SELECT Id FROM Users WHERE Id = @id AND IsDeleted = 0 AND ${scope}`);
  return result.recordset.length > 0;
}

async function updateUserRow(pool, user, id, body, companyId) {
  const request = pool
    .request()
    .input("id",          sql.Int,      id)
    .input("companyId",   sql.Int,      companyId)
    .input("roleId",      sql.Int,      body.roleId      ?? null)
    .input("managerId",   sql.Int,      body.managerId   ?? null)
    .input("username",    sql.NVarChar, body.username    ?? null)
    .input("email",       sql.NVarChar, body.email       ?? null)
    .input("firstName",   sql.NVarChar, body.firstName   ?? null)
    .input("middleName",  sql.NVarChar, body.middleName  ?? null)
    .input("lastName",    sql.NVarChar, body.lastName    ?? null)
    .input("displayName", sql.NVarChar, body.displayName ?? null)
    .input("phoneNumber", sql.NVarChar, body.phoneNumber ?? null)
    .input("isActive",    sql.Bit,      body.isActive    ?? 1);
  const scope = manageableUserFilter(request, user);
  const result = await request.query(`
    UPDATE Users SET
      CompanyId   = @companyId,
      RoleId      = @roleId,
      ManagerId   = @managerId,
      Username    = @username,
      Email       = @email,
      FirstName   = @firstName,
      MiddleName  = @middleName,
      LastName    = @lastName,
      DisplayName = @displayName,
      PhoneNumber = @phoneNumber,
      IsActive    = @isActive,
      UpdatedAtUtc = SYSDATETIMEOFFSET()
    WHERE Id = @id AND IsDeleted = 0 AND ${scope}
  `);
  return result.rowsAffected[0] > 0;
}

// PUT /api/v1/users/:id
async function update(req, res) {
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);
  try {
    const pool = await connectDb();
    if (!(await userExistsInScope(pool, req.user, req.params.id))) return res.status(404).json(NOT_FOUND);
    if (!(await canAssignRole(pool, req.user, req.body.roleId))) return res.status(403).json(ASSIGN_FORBIDDEN);
    if (!(await updateUserRow(pool, req.user, req.params.id, req.body, company.companyId)))
      return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "User updated." });
  } catch (err) {
    logger.error({ err }, "update user error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/v1/users/:id  (soft delete)
async function remove(req, res) {
  if (Number(req.params.id) === Number(req.user.id))
    return res.status(403).json({ success: false, message: "You cannot delete your own account." });
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = manageableUserFilter(request, req.user);
    const result = await request.query(`
      UPDATE Users SET IsDeleted = 1, IsActive = 0, UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "User deleted." });
  } catch (err) {
    logger.error({ err }, "delete user error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/users/roles
async function getRoles(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query("SELECT Id, Name, Code, Description FROM Roles WHERE IsActive = 1 AND IsDeleted = 0 ORDER BY Name");
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "getRoles error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/users/companies  (non-super-admins only see their own company)
async function getCompanies(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request();
    const scope = companyFilter(request, req.user, "Id");
    const result = await request.query(
      `SELECT Id, Name, [Key], City, Country, [Plan] FROM Companies WHERE IsActive = 1 AND IsDeleted = 0 AND ${scope} ORDER BY Name`
    );
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "getCompanies error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, remove, getRoles, getCompanies };
