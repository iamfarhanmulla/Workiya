const { connectDb, sql } = require("../config/db");
const { resolveCompanyId, companyFilter } = require("../services/tenantScope");
const logger = require("../utils/logger");

const NOT_FOUND = { success: false, message: "Doctor not found." };
const ASSIGN_FORBIDDEN = { success: false, message: "You are not allowed to assign this company." };

const DOCTOR_SELECT = `
  SELECT
    d.Id, d.CompanyId, d.CreatedBy,
    d.Name, d.Specialization, d.HospitalName,
    d.PhoneNumber, d.Email, d.Address,
    d.City, d.State, d.Country,
    d.Latitude, d.Longitude, d.PhotoUrl, d.Notes,
    d.IsActive, d.CreatedAtUtc, d.UpdatedAtUtc,
    c.Name AS CompanyName,
    u.FirstName + ' ' + u.LastName AS CreatedByName
  FROM Doctors d
  LEFT JOIN Companies c ON c.Id = d.CompanyId
  LEFT JOIN Users     u ON u.Id  = d.CreatedBy`;

function coordinate(value) {
  return value ? String(value) : null;
}

// Binds the doctor profile fields shared by create and update.
function bindProfile(request, body) {
  return request
    .input("name",          sql.NVarChar, body.name           ?? null)
    .input("specialization",sql.NVarChar, body.specialization || null)
    .input("hospitalName",  sql.NVarChar, body.hospitalName   || null)
    .input("phoneNumber",   sql.NVarChar, body.phoneNumber    || null)
    .input("email",         sql.NVarChar, body.email          || null)
    .input("address",       sql.NVarChar, body.address        || null)
    .input("city",          sql.NVarChar, body.city           || null)
    .input("state",         sql.NVarChar, body.state          || null)
    .input("country",       sql.NVarChar, body.country        || null)
    .input("latitude",      sql.NVarChar, coordinate(body.latitude))
    .input("longitude",     sql.NVarChar, coordinate(body.longitude))
    .input("photoUrl",      sql.NVarChar, body.photoUrl       || null)
    .input("notes",         sql.NVarChar, body.notes          || null);
}

// GET /api/v1/doctors
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request();
    const scope = companyFilter(request, req.user, "d.CompanyId");
    const result = await request.query(`${DOCTOR_SELECT}
      WHERE d.IsDeleted = 0 AND ${scope}
      ORDER BY d.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "doctors getAll error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/doctors/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = companyFilter(request, req.user, "d.CompanyId");
    const result = await request.query(`${DOCTOR_SELECT}
      WHERE d.Id = @id AND d.IsDeleted = 0 AND ${scope}
    `);
    if (result.recordset.length === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error({ err }, "doctors getById error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/v1/doctors
async function create(req, res) {
  if (!req.body.name) return res.status(400).json({ success: false, message: "Doctor name is required." });
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);

  try {
    const pool = await connectDb();
    const request = pool.request()
      .input("companyId", sql.Int, company.companyId)
      .input("createdBy", sql.Int, req.user.id);
    const result = await bindProfile(request, req.body).query(`
      INSERT INTO Doctors
        (CompanyId, CreatedBy, Name, Specialization, HospitalName,
         PhoneNumber, Email, Address, City, State, Country,
         Latitude, Longitude, PhotoUrl, Notes,
         IsActive, IsDeleted, CreatedAtUtc)
      OUTPUT INSERTED.Id
      VALUES
        (@companyId, @createdBy, @name, @specialization, @hospitalName,
         @phoneNumber, @email, @address, @city, @state, @country,
         @latitude, @longitude, @photoUrl, @notes,
         1, 0, SYSDATETIMEOFFSET())
    `);
    return res.status(201).json({ success: true, message: "Doctor created.", id: result.recordset[0].Id });
  } catch (err) {
    logger.error({ err }, "doctors create error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/v1/doctors/:id
async function update(req, res) {
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);

  try {
    const pool = await connectDb();
    const request = pool.request()
      .input("id",        sql.Int, req.params.id)
      .input("companyId", sql.Int, company.companyId)
      .input("isActive",  sql.Bit, req.body.isActive ?? 1);
    bindProfile(request, req.body);
    const scope = companyFilter(request, req.user, "CompanyId");
    const result = await request.query(`
      UPDATE Doctors SET
        CompanyId     = @companyId,
        Name          = @name,
        Specialization= @specialization,
        HospitalName  = @hospitalName,
        PhoneNumber   = @phoneNumber,
        Email         = @email,
        Address       = @address,
        City          = @city,
        State         = @state,
        Country       = @country,
        Latitude      = @latitude,
        Longitude     = @longitude,
        PhotoUrl      = @photoUrl,
        Notes         = @notes,
        IsActive      = @isActive,
        UpdatedAtUtc  = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "Doctor updated." });
  } catch (err) {
    logger.error({ err }, "doctors update error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/v1/doctors/:id/status
async function toggleStatus(req, res) {
  const { isActive } = req.body;
  if (isActive === undefined)
    return res.status(400).json({ success: false, message: "isActive is required." });
  try {
    const pool = await connectDb();
    const request = pool.request()
      .input("id",       sql.Int, req.params.id)
      .input("isActive", sql.Bit, isActive ? 1 : 0);
    const scope = companyFilter(request, req.user, "CompanyId");
    const result = await request.query(`
      UPDATE Doctors SET
        IsActive     = @isActive,
        UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: isActive ? "Doctor activated." : "Doctor deactivated." });
  } catch (err) {
    logger.error({ err }, "doctors toggleStatus error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/v1/doctors/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = companyFilter(request, req.user, "CompanyId");
    const result = await request.query(`
      UPDATE Doctors SET
        IsDeleted    = 1,
        IsActive     = 0,
        UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "Doctor deleted." });
  } catch (err) {
    logger.error({ err }, "doctors remove error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, toggleStatus, remove };
