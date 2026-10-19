const { connectDb, sql } = require("../config/db");

async function insert(entry) {
  const pool = await connectDb();
  await pool
    .request()
    .input("eventType", sql.NVarChar(100), entry.eventType)
    .input("entityType", sql.NVarChar(100), entry.entityType)
    .input("entityId", sql.NVarChar(100), entry.entityId)
    .input("companyId", sql.Int, entry.companyId)
    .input("performedBy", sql.Int, entry.performedBy)
    .input("oldValue", sql.NVarChar(sql.MAX), entry.oldValue)
    .input("newValue", sql.NVarChar(sql.MAX), entry.newValue)
    .input("ipAddress", sql.NVarChar(45), entry.ipAddress)
    .input("userAgent", sql.NVarChar(500), entry.userAgent)
    .query(`
      INSERT INTO AuditLogs
        (EventType, EntityType, EntityId, CompanyId, PerformedBy,
         OldValue, NewValue, IpAddress, UserAgent, CreatedBy)
      VALUES
        (@eventType, @entityType, @entityId, @companyId, @performedBy,
         @oldValue, @newValue, @ipAddress, @userAgent, @performedBy)
    `);
}

module.exports = { insert };
