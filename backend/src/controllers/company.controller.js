const { connectDb, sql } = require("../config/db");
const logger = require("../utils/logger");

// GET /api/v1/companies
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(`
      SELECT
        c.Id, c.Name, c.[Key], c.LogoUrl,
        c.ContactEmail, c.ContactPhone,
        c.Address, c.City, c.Country, c.[Plan],
        c.Status, c.IsActive, c.CreatedAtUtc, c.UpdatedAtUtc,
        (SELECT COUNT(*) FROM Users u WHERE u.CompanyId = c.Id AND u.IsDeleted = 0) AS TotalUsers,
        (SELECT COUNT(*) FROM Users u WHERE u.CompanyId = c.Id AND u.IsDeleted = 0 AND u.RoleId IN (SELECT Id FROM Roles WHERE Code = 'EMPLOYEE')) AS EmployeeCount,
        (SELECT COUNT(*) FROM Users u WHERE u.CompanyId = c.Id AND u.IsDeleted = 0 AND u.RoleId IN (SELECT Id FROM Roles WHERE Code = 'MANAGER')) AS ManagerCount
      FROM Companies c
      WHERE c.IsDeleted = 0
      ORDER BY c.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "companies getAll error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/companies/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        SELECT
          c.Id, c.Name, c.[Key], c.LogoUrl,
          c.ContactEmail, c.ContactPhone,
          c.Address, c.City, c.Country, c.[Plan],
          c.Status, c.IsActive, c.CreatedAtUtc,
          (SELECT COUNT(*) FROM Users u WHERE u.CompanyId = c.Id AND u.IsDeleted = 0) AS TotalUsers,
          (SELECT COUNT(*) FROM Users u WHERE u.CompanyId = c.Id AND u.IsDeleted = 0 AND u.RoleId IN (SELECT Id FROM Roles WHERE Code = 'EMPLOYEE')) AS EmployeeCount,
          (SELECT COUNT(*) FROM Users u WHERE u.CompanyId = c.Id AND u.IsDeleted = 0 AND u.RoleId IN (SELECT Id FROM Roles WHERE Code = 'MANAGER')) AS ManagerCount
        FROM Companies c
        WHERE c.Id = @id AND c.IsDeleted = 0
      `);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Company not found." });
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error({ err }, "companies getById error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/v1/companies
async function create(req, res) {
  const { name, key, contactEmail, contactPhone, address, city, country, plan, logoUrl } = req.body;

  if (!name) return res.status(400).json({ success: false, message: "Company name is required." });

  const derivedKey = (key || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  try {
    const pool = await connectDb();

    const dup = await pool.request()
      .input("key", sql.NVarChar, derivedKey)
      .query("SELECT Id FROM Companies WHERE [Key] = @key AND IsDeleted = 0");
    if (dup.recordset.length > 0)
      return res.status(409).json({ success: false, message: "A company with this key already exists." });

    const result = await pool.request()
      .input("name",         sql.NVarChar, name)
      .input("key",          sql.NVarChar, derivedKey)
      .input("logoUrl",      sql.NVarChar, logoUrl      || null)
      .input("contactEmail", sql.NVarChar, contactEmail || null)
      .input("contactPhone", sql.NVarChar, contactPhone || null)
      .input("address",      sql.NVarChar, address      || null)
      .input("city",         sql.NVarChar, city         || null)
      .input("country",      sql.NVarChar, country      || null)
      .input("plan",         sql.NVarChar, plan         || "STARTUP")
      .query(`
        INSERT INTO Companies
          (Name, [Key], LogoUrl, ContactEmail, ContactPhone,
           Address, City, Country, [Plan],
           Status, IsActive, IsDeleted, CreatedAtUtc)
        OUTPUT INSERTED.Id
        VALUES
          (@name, @key, @logoUrl, @contactEmail, @contactPhone,
           @address, @city, @country, @plan,
           1, 1, 0, SYSDATETIMEOFFSET())
      `);

    return res.status(201).json({ success: true, message: "Company created.", id: result.recordset[0].Id });
  } catch (err) {
    logger.error({ err }, "companies create error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/v1/companies/:id
async function update(req, res) {
  const { name, key, contactEmail, contactPhone, address, city, country, plan, logoUrl, isActive } = req.body;

  try {
    const pool = await connectDb();

    const exists = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Id FROM Companies WHERE Id = @id AND IsDeleted = 0");
    if (exists.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Company not found." });

    await pool.request()
      .input("id",           sql.Int,      req.params.id)
      .input("name",         sql.NVarChar, name         ?? null)
      .input("key",          sql.NVarChar, key          ?? null)
      .input("logoUrl",      sql.NVarChar, logoUrl      ?? null)
      .input("contactEmail", sql.NVarChar, contactEmail ?? null)
      .input("contactPhone", sql.NVarChar, contactPhone ?? null)
      .input("address",      sql.NVarChar, address      ?? null)
      .input("city",         sql.NVarChar, city         ?? null)
      .input("country",      sql.NVarChar, country      ?? null)
      .input("plan",         sql.NVarChar, plan         ?? null)
      .input("isActive",     sql.Bit,      isActive     ?? 1)
      .query(`
        UPDATE Companies SET
          Name         = @name,
          [Key]        = @key,
          LogoUrl      = @logoUrl,
          ContactEmail = @contactEmail,
          ContactPhone = @contactPhone,
          Address      = @address,
          City         = @city,
          Country      = @country,
          [Plan]       = @plan,
          IsActive     = @isActive,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);

    return res.json({ success: true, message: "Company updated." });
  } catch (err) {
    logger.error({ err }, "companies update error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/v1/companies/:id/status
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
        UPDATE Companies SET
          IsActive     = @isActive,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id AND IsDeleted = 0
      `);
    return res.json({ success: true, message: isActive ? "Company activated." : "Company deactivated." });
  } catch (err) {
    logger.error({ err }, "companies toggleStatus error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/v1/companies/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        UPDATE Companies SET IsDeleted = 1, IsActive = 0, UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "Company deleted." });
  } catch (err) {
    logger.error({ err }, "companies remove error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, toggleStatus, remove };
