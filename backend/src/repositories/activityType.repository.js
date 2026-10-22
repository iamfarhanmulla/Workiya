const { connectDb, sql } = require("../config/db");

const COLUMNS = `Id, CompanyId, Code, Name, RequiresCheckIn, GeofenceMeters, MinPhotos,
  RequiresSignature, RequiresCustomerOtp, IsActive`;

const OUTPUT_COLUMNS = COLUMNS.split(",").map((column) => `INSERTED.${column.trim()}`).join(", ");

const OPEN_ACTIVITY_STATUSES = "N'Pending', N'InProgress'";

function bindType(request, type) {
  return request
    .input("code", sql.NVarChar(50), type.code)
    .input("name", sql.NVarChar(100), type.name)
    .input("requiresCheckIn", sql.Bit, type.requiresCheckIn ? 1 : 0)
    .input("geofenceMeters", sql.Int, type.geofenceMeters ?? null)
    .input("minPhotos", sql.TinyInt, type.minPhotos)
    .input("requiresSignature", sql.Bit, type.requiresSignature ? 1 : 0)
    .input("requiresCustomerOtp", sql.Bit, type.requiresCustomerOtp ? 1 : 0)
    .input("isActive", sql.Bit, type.isActive ? 1 : 0);
}

async function list(companyId, { includeInactive = false } = {}) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("includeInactive", sql.Bit, includeInactive ? 1 : 0)
    .query(`
      SELECT ${COLUMNS}
      FROM ActivityTypes
      WHERE CompanyId = @companyId AND IsDeleted = 0
        AND (@includeInactive = 1 OR IsActive = 1)
      ORDER BY Name
    `);
  return result.recordset;
}

async function findById(companyId, id) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("id", sql.Int, id)
    .query(`
      SELECT ${COLUMNS}
      FROM ActivityTypes
      WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.recordset[0] || null;
}

async function insert(companyId, type, userId) {
  const pool = await connectDb();
  const request = pool.request()
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId);
  const result = await bindType(request, type).query(`
    INSERT INTO ActivityTypes
      (CompanyId, Code, Name, RequiresCheckIn, GeofenceMeters, MinPhotos, RequiresSignature,
       RequiresCustomerOtp, IsActive, CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy, IsDeleted)
    OUTPUT ${OUTPUT_COLUMNS}
    VALUES
      (@companyId, @code, @name, @requiresCheckIn, @geofenceMeters, @minPhotos, @requiresSignature,
       @requiresCustomerOtp, @isActive, GETUTCDATE(), @userId, GETUTCDATE(), @userId, 0)
  `);
  return result.recordset[0];
}

async function update(companyId, id, type, userId) {
  const pool = await connectDb();
  const request = pool.request()
    .input("companyId", sql.Int, companyId)
    .input("id", sql.Int, id)
    .input("userId", sql.Int, userId);
  const result = await bindType(request, type).query(`
    UPDATE ActivityTypes SET
      Code = @code, Name = @name, RequiresCheckIn = @requiresCheckIn,
      GeofenceMeters = @geofenceMeters, MinPhotos = @minPhotos,
      RequiresSignature = @requiresSignature, RequiresCustomerOtp = @requiresCustomerOtp,
      IsActive = @isActive, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
    OUTPUT ${OUTPUT_COLUMNS}
    WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
  `);
  return result.recordset[0] || null;
}

async function countOpenActivities(companyId, id) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("id", sql.Int, id)
    .query(`
      SELECT COUNT(*) AS Total
      FROM Activities
      WHERE CompanyId = @companyId AND ActivityTypeId = @id AND IsDeleted = 0
        AND Status IN (${OPEN_ACTIVITY_STATUSES})
    `);
  return result.recordset[0] ? result.recordset[0].Total : 0;
}

async function softDelete(companyId, id, userId) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("id", sql.Int, id)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE ActivityTypes SET
        IsDeleted = 1, IsActive = 0, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.rowsAffected[0] > 0;
}

module.exports = {
  list, findById, insert, update, countOpenActivities, softDelete,
};
