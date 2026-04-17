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

// GET /api/users
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(`
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
      LEFT JOIN Users m ON m.Id = u.ManagerId
      WHERE u.IsDeleted = 0
      ORDER BY u.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("getAll users error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/users/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
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
        LEFT JOIN Users m ON m.Id = u.ManagerId
        WHERE u.Id = @id AND u.IsDeleted = 0
      `);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: "User not found." });
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("getById user error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/users
async function create(req, res) {
  const { companyId, roleId, managerId, username, email, password,
          firstName, middleName, lastName, displayName, phoneNumber } = req.body;

  if (!email || !password || !roleId) {
    return res.status(400).json({ success: false, message: "Email, password and roleId are required." });
  }

  try {
    const pool = await connectDb();

    const exists = await pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT Id FROM Users WHERE Email = @email");
    if (exists.recordset.length > 0)
      return res.status(409).json({ success: false, message: "Email already in use." });

    const { passwordHash, passwordSalt, passwordIterations } = generateHash(password);

    const result = await pool
      .request()
      .input("companyId",           sql.Int,            companyId   || null)
      .input("roleId",              sql.Int,            roleId)
      .input("managerId",           sql.Int,            managerId   || null)
      .input("username",            sql.NVarChar,       username    || null)
      .input("email",               sql.NVarChar,       email)
      .input("passwordHash",        sql.NVarChar,       passwordHash)
      .input("passwordSalt",        sql.NVarChar,       passwordSalt)
      .input("passwordIterations",  sql.Int,            passwordIterations)
      .input("firstName",           sql.NVarChar,       firstName   || null)
      .input("middleName",          sql.NVarChar,       middleName  || null)
      .input("lastName",            sql.NVarChar,       lastName    || null)
      .input("displayName",         sql.NVarChar,       displayName || null)
      .input("phoneNumber",         sql.NVarChar,       phoneNumber || null)
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

    return res.status(201).json({ success: true, message: "User created.", id: result.recordset[0].Id });
  } catch (err) {
    console.error("create user error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/users/:id
async function update(req, res) {
  const { companyId, roleId, managerId, username, email,
          firstName, middleName, lastName, displayName, phoneNumber, isActive } = req.body;

  try {
    const pool = await connectDb();

    const exists = await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Id FROM Users WHERE Id = @id AND IsDeleted = 0");
    if (exists.recordset.length === 0)
      return res.status(404).json({ success: false, message: "User not found." });

    await pool
      .request()
      .input("id",          sql.Int,      req.params.id)
      .input("companyId",   sql.Int,      companyId  ?? null)
      .input("roleId",      sql.Int,      roleId     ?? null)
      .input("managerId",   sql.Int,      managerId  ?? null)
      .input("username",    sql.NVarChar, username   ?? null)
      .input("email",       sql.NVarChar, email      ?? null)
      .input("firstName",   sql.NVarChar, firstName  ?? null)
      .input("middleName",  sql.NVarChar, middleName ?? null)
      .input("lastName",    sql.NVarChar, lastName   ?? null)
      .input("displayName", sql.NVarChar, displayName ?? null)
      .input("phoneNumber", sql.NVarChar, phoneNumber ?? null)
      .input("isActive",    sql.Bit,      isActive ?? 1)
      .query(`
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
        WHERE Id = @id
      `);

    return res.json({ success: true, message: "User updated." });
  } catch (err) {
    console.error("update user error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/users/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    await pool
      .request()
      .input("id", sql.Int, req.params.id)
      .query(`
        UPDATE Users SET IsDeleted = 1, IsActive = 0, UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "User deleted." });
  } catch (err) {
    console.error("delete user error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/users/roles
async function getRoles(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query("SELECT Id, Name, Code, Description FROM Roles WHERE IsActive = 1 AND IsDeleted = 0 ORDER BY Name");
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("getRoles error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/users/companies
async function getCompanies(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(
      "SELECT Id, Name, [Key], City, Country, [Plan] FROM Companies WHERE IsActive = 1 AND IsDeleted = 0 ORDER BY Name"
    );
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("getCompanies error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, remove, getRoles, getCompanies };
