const { connectDb, sql } = require("../config/db");

// GET /api/doctors
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(`
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
      LEFT JOIN Users     u ON u.Id  = d.CreatedBy
      WHERE d.IsDeleted = 0
      ORDER BY d.CreatedAtUtc DESC
    `);
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("doctors getAll error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/doctors/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
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
        LEFT JOIN Users     u ON u.Id  = d.CreatedBy
        WHERE d.Id = @id AND d.IsDeleted = 0
      `);
    if (result.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Doctor not found." });
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("doctors getById error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/doctors
async function create(req, res) {
  const {
    companyId, createdBy,
    name, specialization, hospitalName,
    phoneNumber, email, address,
    city, state, country,
    latitude, longitude, photoUrl, notes,
  } = req.body;

  if (!name) return res.status(400).json({ success: false, message: "Doctor name is required." });

  const lat = latitude  || null;
  const lng = longitude || null;

  try {
    const pool = await connectDb();
    const result = await pool.request()
      .input("companyId",     sql.Int,      companyId     || null)
      .input("createdBy",     sql.Int,      createdBy     || null)
      .input("name",          sql.NVarChar, name)
      .input("specialization",sql.NVarChar, specialization|| null)
      .input("hospitalName",  sql.NVarChar, hospitalName  || null)
      .input("phoneNumber",   sql.NVarChar, phoneNumber   || null)
      .input("email",         sql.NVarChar, email         || null)
      .input("address",       sql.NVarChar, address       || null)
      .input("city",          sql.NVarChar, city          || null)
      .input("state",         sql.NVarChar, state         || null)
      .input("country",       sql.NVarChar, country       || null)
      .input("latitude",      sql.NVarChar, lat != null ? String(lat) : null)
      .input("longitude",     sql.NVarChar, lng != null ? String(lng) : null)
      .input("photoUrl",      sql.NVarChar, photoUrl      || null)
      .input("notes",         sql.NVarChar, notes         || null)
      .query(`
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
    console.error("doctors create error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/doctors/:id
async function update(req, res) {
  const {
    companyId, name, specialization, hospitalName,
    phoneNumber, email, address,
    city, state, country,
    latitude, longitude, photoUrl, notes, isActive,
  } = req.body;

  const lat = latitude  || null;
  const lng = longitude || null;

  try {
    const pool = await connectDb();
    const exists = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Id FROM Doctors WHERE Id = @id AND IsDeleted = 0");
    if (exists.recordset.length === 0)
      return res.status(404).json({ success: false, message: "Doctor not found." });

    await pool.request()
      .input("id",            sql.Int,      req.params.id)
      .input("companyId",     sql.Int,      companyId     ?? null)
      .input("name",          sql.NVarChar, name          ?? null)
      .input("specialization",sql.NVarChar, specialization?? null)
      .input("hospitalName",  sql.NVarChar, hospitalName  ?? null)
      .input("phoneNumber",   sql.NVarChar, phoneNumber   ?? null)
      .input("email",         sql.NVarChar, email         ?? null)
      .input("address",       sql.NVarChar, address       ?? null)
      .input("city",          sql.NVarChar, city          ?? null)
      .input("state",         sql.NVarChar, state         ?? null)
      .input("country",       sql.NVarChar, country       ?? null)
      .input("latitude",      sql.NVarChar, lat != null ? String(lat) : null)
      .input("longitude",     sql.NVarChar, lng != null ? String(lng) : null)
      .input("photoUrl",      sql.NVarChar, photoUrl      ?? null)
      .input("notes",         sql.NVarChar, notes         ?? null)
      .input("isActive",      sql.Bit,      isActive      ?? 1)
      .query(`
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
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "Doctor updated." });
  } catch (err) {
    console.error("doctors update error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/doctors/:id/status
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
        UPDATE Doctors SET
          IsActive     = @isActive,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id AND IsDeleted = 0
      `);
    return res.json({ success: true, message: isActive ? "Doctor activated." : "Doctor deactivated." });
  } catch (err) {
    console.error("doctors toggleStatus error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/doctors/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(`
        UPDATE Doctors SET
          IsDeleted    = 1,
          IsActive     = 0,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "Doctor deleted." });
  } catch (err) {
    console.error("doctors remove error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, toggleStatus, remove };
