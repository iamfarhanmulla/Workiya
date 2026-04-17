const crypto = require("crypto");
const { connectDb, sql } = require("../config/db");

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

// GET /api/managers
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(`
      SELECT
        u.Id, u.FirstName, u.MiddleName, u.LastName, u.DisplayName,
        u.Email, u.PhoneNumber, u.ProfilePhotoUrl,
        u.CompanyId, c.Name AS CompanyName,
        u.RoleId, r.Name AS RoleName,
        u.Status, u.IsActive, u.CreatedAtUtc, u.UpdatedAtUtc,
        (SELECT COUNT(*) FROM Users e WHERE e.ManagerId = u.Id AND e.IsDeleted = 0) AS EmployeeCount,
        (SELECT COUNT(*) FROM Tasks t WHERE t.AssignedBy = u.Id AND t.IsDeleted = 0) AS TaskCount
      FROM Users u
      LEFT JOIN Companies c ON c.Id = u.CompanyId
      LEFT JOIN Roles r     ON r.Id = u.RoleId
      WHERE u.IsDeleted = 0
        AND r.Name = 'Manager'
      ORDER BY u.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("managers getAll error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/managers/:id
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
          u.Status, u.IsActive, u.CreatedAtUtc
        FROM Users u
        LEFT JOIN Companies c ON c.Id = u.CompanyId
        LEFT JOIN Roles r     ON r.Id = u.RoleId
        WHERE u.Id = @id AND u.IsDeleted = 0
      `);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Manager not found." });
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("managers getById error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/managers
async function create(req, res) {
  const { firstName, lastName, middleName, email, phoneNumber,
          displayName, companyId, password } = req.body;

  if (!email) return res.status(400).json({ success: false, message: "Email is required." });

  try {
    const pool = await connectDb();

    // Check duplicate email
    const dup = await pool.request()
      .input("email", sql.NVarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");
    if (dup.recordset.length > 0)
      return res.status(409).json({ success: false, message: "Email already in use." });

    const roleId = 4; // Manager role

    const pwd = password || "Manager@123";
    const { passwordHash, passwordSalt, passwordIterations } = generateHash(pwd);
    const username = email.split("@")[0];

    const result = await pool.request()
      .input("roleId",             sql.Int,            roleId)
      .input("companyId",          sql.Int,            companyId   || null)
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
          (RoleId, CompanyId, FirstName, MiddleName, LastName, DisplayName,
           Username, Email, PhoneNumber, PasswordHash, PasswordSalt, PasswordIterations,
           Status, IsActive, IsDeleted, CreatedAtUtc)
        OUTPUT INSERTED.Id
        VALUES
          (@roleId, @companyId, @firstName, @middleName, @lastName, @displayName,
           @username, @email, @phoneNumber, @passwordHash, @passwordSalt, @passwordIterations,
           1, 1, 0, SYSDATETIMEOFFSET())
      `);

    return res.status(201).json({ success: true, message: "Manager created.", id: result.recordset[0].Id });
  } catch (err) {
    console.error("managers create error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/managers/:id
async function update(req, res) {
  const { firstName, lastName, middleName, email,
          phoneNumber, displayName, companyId, isActive } = req.body;
  try {
    const pool = await connectDb();
    const exists = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Id FROM Users WHERE Id = @id AND IsDeleted = 0");
    if (exists.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Manager not found." });

    await pool.request()
      .input("id",          sql.Int,      req.params.id)
      .input("firstName",   sql.NVarChar, firstName   ?? null)
      .input("middleName",  sql.NVarChar, middleName  ?? null)
      .input("lastName",    sql.NVarChar, lastName    ?? null)
      .input("displayName", sql.NVarChar, displayName ?? null)
      .input("email",       sql.NVarChar, email       ?? null)
      .input("phoneNumber", sql.NVarChar, phoneNumber ?? null)
      .input("companyId",   sql.Int,      companyId   ?? null)
      .input("isActive",    sql.Bit,      isActive    ?? 1)
      .query(`
        UPDATE Users SET
          FirstName   = @firstName,
          MiddleName  = @middleName,
          LastName    = @lastName,
          DisplayName = @displayName,
          Email       = @email,
          PhoneNumber = @phoneNumber,
          CompanyId   = @companyId,
          IsActive    = @isActive,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);

    return res.json({ success: true, message: "Manager updated." });
  } catch (err) {
    console.error("managers update error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/managers/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        UPDATE Users SET IsDeleted = 1, IsActive = 0, UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "Manager deleted." });
  } catch (err) {
    console.error("managers remove error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/managers/:id/status
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
    return res.json({ success: true, message: isActive ? "Manager activated." : "Manager deactivated." });
  } catch (err) {
    console.error("toggleStatus error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, remove, toggleStatus };
