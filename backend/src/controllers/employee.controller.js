const crypto = require("crypto");
const { connectDb, sql } = require("../config/db");

const EMPLOYEE_ROLE_ID = 3;

function generateHash(password) {
  const salt = crypto.randomBytes(16);
  const iterations = 10000;
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  return {
    passwordSalt: salt.toString("base64"),
    passwordHash: hash.toString("base64"),
    passwordIterations: iterations
  };
}

// GET /api/employees
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(`
      SELECT
        u.Id, u.FirstName, u.MiddleName, u.LastName, u.DisplayName,
        u.Email, u.PhoneNumber, u.ProfilePhotoUrl,
        u.CompanyId, c.Name AS CompanyName,
        u.RoleId, r.Name AS RoleName,
        u.ManagerId,
        CONCAT(m.FirstName, ' ', m.LastName) AS ManagerName,
        u.Status, u.IsActive, u.CreatedAtUtc, u.UpdatedAtUtc,
        (SELECT COUNT(*) FROM Tasks t WHERE t.AssignedTo = u.Id AND t.IsDeleted = 0)                              AS TaskCount,
        (SELECT COUNT(*) FROM Tasks t WHERE t.AssignedTo = u.Id AND t.Status = 'Completed' AND t.IsDeleted = 0)  AS TaskDone
      FROM Users u
      LEFT JOIN Companies c ON c.Id = u.CompanyId
      LEFT JOIN Roles r     ON r.Id = u.RoleId
      LEFT JOIN Users m     ON m.Id = u.ManagerId
      WHERE u.IsDeleted = 0
        AND u.RoleId = ${EMPLOYEE_ROLE_ID}
      ORDER BY u.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("employees getAll error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/employees/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          u.Id, u.FirstName, u.MiddleName, u.LastName, u.DisplayName,
          u.Email, u.PhoneNumber, u.ProfilePhotoUrl,
          u.CompanyId, c.Name AS CompanyName,
          u.RoleId, r.Name AS RoleName,
          u.ManagerId, CONCAT(m.FirstName, ' ', m.LastName) AS ManagerName,
          u.Status, u.IsActive, u.CreatedAtUtc,
          (SELECT COUNT(*) FROM Tasks t WHERE t.AssignedTo = u.Id AND t.IsDeleted = 0)                             AS TaskCount,
          (SELECT COUNT(*) FROM Tasks t WHERE t.AssignedTo = u.Id AND t.Status = 'Completed' AND t.IsDeleted = 0) AS TaskDone
        FROM Users u
        LEFT JOIN Companies c ON c.Id = u.CompanyId
        LEFT JOIN Roles r     ON r.Id = u.RoleId
        LEFT JOIN Users m     ON m.Id = u.ManagerId
        WHERE u.Id = @id AND u.IsDeleted = 0
      `);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Employee not found." });
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("employees getById error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/employees
async function create(req, res) {
  const { firstName, lastName, middleName, email,
          phoneNumber, displayName, companyId, managerId, password } = req.body;

  if (!email) return res.status(400).json({ success: false, message: "Email is required." });

  try {
    const pool = await connectDb();

    const dup = await pool.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");
    if (dup.recordset.length > 0)
      return res.status(409).json({ success: false, message: "Email already in use." });

    const pwd = password || "Employee@123";
    const { passwordHash, passwordSalt, passwordIterations } = generateHash(pwd);

    const username = email.split("@")[0];

    const result = await pool.request()
      .input("roleId",             sql.Int,            EMPLOYEE_ROLE_ID)
      .input("companyId",          sql.Int,            companyId   || null)
      .input("managerId",          sql.Int,            managerId   || null)
      .input("firstName",          sql.NVarChar,       firstName   || null)
      .input("middleName",         sql.NVarChar,       middleName  || null)
      .input("lastName",           sql.NVarChar,       lastName    || null)
      .input("displayName",        sql.NVarChar,       displayName || null)
      .input("username",           sql.NVarChar,       username)
      .input("email",              sql.NVarChar,       email)
      .input("phoneNumber",        sql.NVarChar,       phoneNumber || null)
      .input("passwordHash",       sql.NVarChar,       passwordHash)
      .input("passwordSalt",       sql.NVarChar,       passwordSalt)
      .input("passwordIterations", sql.Int,            passwordIterations)
      .query(`
        INSERT INTO Users
          (RoleId, CompanyId, ManagerId, FirstName, MiddleName, LastName, DisplayName,
           Username, Email, PhoneNumber, PasswordHash, PasswordSalt, PasswordIterations,
           Status, IsActive, IsDeleted, CreatedAtUtc)
        OUTPUT INSERTED.Id
        VALUES
          (@roleId, @companyId, @managerId, @firstName, @middleName, @lastName, @displayName,
           @username, @email, @phoneNumber, @passwordHash, @passwordSalt, @passwordIterations,
           1, 1, 0, SYSDATETIMEOFFSET())
      `);

    return res.status(201).json({ success: true, message: "Employee created.", id: result.recordset[0].Id });
  } catch (err) {
    console.error("employees create error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/employees/:id
async function update(req, res) {
  const { firstName, lastName, middleName, email,
          phoneNumber, displayName, companyId, managerId, isActive } = req.body;
  try {
    const pool = await connectDb();

    const exists = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Id FROM Users WHERE Id = @id AND IsDeleted = 0");
    if (exists.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Employee not found." });

    await pool.request()
      .input("id",          sql.Int,      req.params.id)
      .input("firstName",   sql.NVarChar, firstName   ?? null)
      .input("middleName",  sql.NVarChar, middleName  ?? null)
      .input("lastName",    sql.NVarChar, lastName    ?? null)
      .input("displayName", sql.NVarChar, displayName ?? null)
      .input("email",       sql.NVarChar, email       ?? null)
      .input("phoneNumber", sql.NVarChar, phoneNumber ?? null)
      .input("companyId",   sql.Int,      companyId   ?? null)
      .input("managerId",   sql.Int,      managerId   ?? null)
      .input("isActive",    sql.Bit,      isActive    ?? 1)
      .query(`
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
        WHERE Id = @id
      `);

    return res.json({ success: true, message: "Employee updated." });
  } catch (err) {
    console.error("employees update error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/employees/:id/status
async function toggleStatus(req, res) {
  const { isActive } = req.body;
  if (isActive === undefined)
    return res.status(400).json({ success: false, message: "isActive is required." });
  try {
    const pool = await connectDb();
    await pool.request()
      .input("id",       sql.Int, req.params.id)
      .input("isActive", sql.Bit, isActive ? 1 : 0)
      .query(`
        UPDATE Users SET
          IsActive     = @isActive,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id AND IsDeleted = 0
      `);
    return res.json({ success: true, message: isActive ? "Employee activated." : "Employee deactivated." });
  } catch (err) {
    console.error("toggleStatus error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/employees/:id (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        UPDATE Users SET IsDeleted = 1, IsActive = 0, UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "Employee deleted." });
  } catch (err) {
    console.error("employees remove error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/employees/managers-list  (for dropdown)
async function getManagersList(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(`
      SELECT u.Id, CONCAT(u.FirstName, ' ', u.LastName) AS Name, u.CompanyId, c.Name AS CompanyName
      FROM Users u
      LEFT JOIN Companies c ON c.Id = u.CompanyId
      WHERE u.RoleId = 4 AND u.IsDeleted = 0 AND u.IsActive = 1
      ORDER BY u.FirstName
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("getManagersList error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, toggleStatus, remove, getManagersList };
