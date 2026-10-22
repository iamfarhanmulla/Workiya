const { connectDb, sql } = require("../config/db");
const { ROLES } = require("../constants/roles");
const passwordService = require("../services/password.service");
const passwordReset = require("../services/passwordReset.service");
const {
  resolveCompanyId, companyFilter, roleFilter, toId,
} = require("../services/tenantScope");
const logger = require("../utils/logger");

const ASSIGN_FORBIDDEN = {
  success: false,
  message: "You are not allowed to assign this role or company.",
};
const NOT_FOUND = { success: false, message: "Employee not found." };
const PASSWORD_RULE = `Password must be at least ${passwordService.MIN_PASSWORD_LENGTH} `
  + "characters.";

const EMPLOYEE_SELECT = `
  SELECT
    u.Id, u.FirstName, u.MiddleName, u.LastName, u.DisplayName,
    u.Email, u.PhoneNumber, u.ProfilePhotoUrl,
    u.CompanyId, c.Name AS CompanyName,
    u.RoleId, r.Name AS RoleName,
    u.ManagerId,
    CONCAT(m.FirstName, ' ', m.LastName) AS ManagerName,
    u.Status, u.IsActive, u.CreatedAtUtc, u.UpdatedAtUtc,
    (SELECT COUNT(*) FROM Tasks t WHERE t.AssignedTo = u.Id AND t.IsDeleted = 0) AS TaskCount,
    (SELECT COUNT(*) FROM Tasks t
      WHERE t.AssignedTo = u.Id AND t.Status = 'Completed' AND t.IsDeleted = 0) AS TaskDone
  FROM Users u
  LEFT JOIN Companies c ON c.Id = u.CompanyId
  LEFT JOIN Roles r     ON r.Id = u.RoleId
  LEFT JOIN Users m     ON m.Id = u.ManagerId`;

// Binds the employee-role and caller-company filters on a dbo.Users request.
function employeeScope(request, user, prefix = "") {
  const role = roleFilter(request, ROLES.EMPLOYEE, prefix);
  return `${role} AND ${companyFilter(request, user, `${prefix}CompanyId`)}`;
}

// GET /api/v1/employees
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request();
    const scope = employeeScope(request, req.user, "u.");
    const result = await request.query(`${EMPLOYEE_SELECT}
      WHERE u.IsDeleted = 0 AND ${scope}
      ORDER BY u.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "employees getAll error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/employees/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = employeeScope(request, req.user, "u.");
    const result = await request.query(`${EMPLOYEE_SELECT}
      WHERE u.Id = @id AND u.IsDeleted = 0 AND ${scope}
    `);
    if (result.recordset.length === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error({ err }, "employees getById error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

async function insertEmployee(pool, fields) {
  const {
    passwordHash, passwordSalt, passwordIterations,
  } = passwordService.hashForSharedUsersTable(fields.password);
  const result = await pool.request()
    .input("roleCode", sql.NVarChar, ROLES.EMPLOYEE)
    .input("companyId", sql.Int, fields.companyId)
    .input("managerId", sql.Int, fields.managerId || null)
    .input("firstName", sql.NVarChar, fields.firstName || null)
    .input("middleName", sql.NVarChar, fields.middleName || null)
    .input("lastName", sql.NVarChar, fields.lastName || null)
    .input("displayName", sql.NVarChar, fields.displayName || null)
    .input("username", sql.NVarChar, fields.email.split("@")[0])
    .input("email", sql.NVarChar, fields.email)
    .input("phoneNumber", sql.NVarChar, fields.phoneNumber || null)
    .input("passwordHash", sql.NVarChar, passwordHash)
    .input("passwordSalt", sql.NVarChar, passwordSalt)
    .input("passwordIterations", sql.Int, passwordIterations)
    .query(`
      INSERT INTO Users
        (RoleId, CompanyId, ManagerId, FirstName, MiddleName, LastName, DisplayName,
         Username, Email, PhoneNumber, PasswordHash, PasswordSalt, PasswordIterations,
         Status, IsActive, IsDeleted, CreatedAtUtc)
      OUTPUT INSERTED.Id
      SELECT r.Id, @companyId, @managerId, @firstName, @middleName, @lastName, @displayName,
             @username, @email, @phoneNumber, @passwordHash, @passwordSalt, @passwordIterations,
             1, 1, 0, SYSDATETIMEOFFSET()
      FROM Roles r WHERE r.Code = @roleCode
    `);
  return result.recordset[0].Id;
}

// POST /api/v1/employees
async function create(req, res) {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required." });
  if (!passwordService.isAcceptablePassword(password)) {
    return res.status(400).json({ success: false, message: PASSWORD_RULE });
  }
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);

  try {
    const pool = await connectDb();
    const dup = await pool.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");
    if (dup.recordset.length > 0) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }

    const id = await insertEmployee(pool, { ...req.body, companyId: company.companyId });
    return res.status(201).json({ success: true, message: "Employee created.", id });
  } catch (err) {
    logger.error({ err }, "employees create error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/v1/employees/:id
async function update(req, res) {
  const {
    firstName, lastName, middleName, email, phoneNumber, displayName, managerId, isActive,
  } = req.body;
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);
  const newPassword = passwordReset.readNewPassword(req.body);
  if (newPassword.error) {
    return res.status(400).json({ success: false, message: newPassword.error });
  }
  try {
    const pool = await connectDb();
    const request = pool.request()
      .input("id", sql.Int, req.params.id)
      .input("firstName", sql.NVarChar, firstName ?? null)
      .input("middleName", sql.NVarChar, middleName ?? null)
      .input("lastName", sql.NVarChar, lastName ?? null)
      .input("displayName", sql.NVarChar, displayName ?? null)
      .input("email", sql.NVarChar, email ?? null)
      .input("phoneNumber", sql.NVarChar, phoneNumber ?? null)
      .input("companyId", sql.Int, company.companyId)
      .input("managerId", sql.Int, toId(managerId))
      .input("isActive", sql.Bit, isActive ?? 1);
    const scope = employeeScope(request, req.user);
    const result = await request.query(`
      UPDATE Users SET
        FirstName    = @firstName,
        MiddleName   = @middleName,
        LastName     = @lastName,
        DisplayName  = @displayName,
        Email        = @email,
        PhoneNumber  = @phoneNumber,
        CompanyId    = @companyId,
        ManagerId    = @managerId,
        IsActive     = @isActive,
        UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    if (newPassword.password) {
      await passwordReset.resetPassword(req.user, req.params.id, newPassword.password, req);
    }
    const message = passwordReset.updatedMessage("Employee", Boolean(newPassword.password));
    return res.json({ success: true, message });
  } catch (err) {
    logger.error({ err }, "employees update error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/v1/employees/:id/status
async function toggleStatus(req, res) {
  const { isActive } = req.body;
  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: "isActive is required." });
  }
  try {
    const pool = await connectDb();
    const request = pool.request()
      .input("id", sql.Int, req.params.id)
      .input("isActive", sql.Bit, isActive ? 1 : 0);
    const scope = employeeScope(request, req.user);
    const result = await request.query(`
      UPDATE Users SET
        IsActive     = @isActive,
        UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({
      success: true,
      message: isActive ? "Employee activated." : "Employee deactivated.",
    });
  } catch (err) {
    logger.error({ err }, "employees toggleStatus error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/v1/employees/:id (soft delete)
async function remove(req, res) {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(403).json({ success: false, message: "You cannot delete your own account." });
  }
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = employeeScope(request, req.user);
    const result = await request.query(`
      UPDATE Users SET IsDeleted = 1, IsActive = 0, UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "Employee deleted." });
  } catch (err) {
    logger.error({ err }, "employees remove error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/employees/managers-list  (for dropdown)
async function getManagersList(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request();
    const role = roleFilter(request, ROLES.MANAGER, "u.");
    const scope = companyFilter(request, req.user, "u.CompanyId");
    const result = await request.query(`
      SELECT u.Id, CONCAT(u.FirstName, ' ', u.LastName) AS Name, u.CompanyId, c.Name AS CompanyName
      FROM Users u
      LEFT JOIN Companies c ON c.Id = u.CompanyId
      WHERE u.IsDeleted = 0 AND u.IsActive = 1 AND ${role} AND ${scope}
      ORDER BY u.FirstName
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "getManagersList error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = {
  getAll, getById, create, update, toggleStatus, remove, getManagersList,
};
