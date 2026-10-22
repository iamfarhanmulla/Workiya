const { connectDb, sql } = require("../config/db");

const COLUMNS = `Id, CompanyId, EntityType, FieldKey, Label, DataType, IsRequired,
  OptionsJson, SortOrder, IsActive`;

function serializeOptions(options) {
  return Array.isArray(options) ? JSON.stringify(options) : null;
}

async function list(companyId, { entityType = null, includeInactive = false } = {}) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("entityType", sql.NVarChar(30), entityType)
    .input("includeInactive", sql.Bit, includeInactive ? 1 : 0)
    .query(`
      SELECT ${COLUMNS}
      FROM CustomFieldDefinitions
      WHERE CompanyId = @companyId AND IsDeleted = 0
        AND (@entityType IS NULL OR EntityType = @entityType)
        AND (@includeInactive = 1 OR IsActive = 1)
      ORDER BY SortOrder, Label
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
      FROM CustomFieldDefinitions
      WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.recordset[0] || null;
}

async function insert(companyId, field, userId) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("entityType", sql.NVarChar(30), field.entityType)
    .input("fieldKey", sql.NVarChar(50), field.fieldKey)
    .input("label", sql.NVarChar(100), field.label)
    .input("dataType", sql.NVarChar(20), field.dataType)
    .input("isRequired", sql.Bit, field.isRequired ? 1 : 0)
    .input("optionsJson", sql.NVarChar(sql.MAX), serializeOptions(field.options))
    .input("sortOrder", sql.Int, field.sortOrder)
    .input("isActive", sql.Bit, field.isActive ? 1 : 0)
    .input("userId", sql.Int, userId)
    .query(`
      INSERT INTO CustomFieldDefinitions
        (CompanyId, EntityType, FieldKey, Label, DataType, IsRequired, OptionsJson, SortOrder,
         IsActive, CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy, IsDeleted)
      OUTPUT INSERTED.Id, INSERTED.CompanyId, INSERTED.EntityType, INSERTED.FieldKey,
        INSERTED.Label, INSERTED.DataType, INSERTED.IsRequired, INSERTED.OptionsJson,
        INSERTED.SortOrder, INSERTED.IsActive
      VALUES
        (@companyId, @entityType, @fieldKey, @label, @dataType, @isRequired, @optionsJson,
         @sortOrder, @isActive, GETUTCDATE(), @userId, GETUTCDATE(), @userId, 0)
    `);
  return result.recordset[0];
}

async function update(companyId, id, field, userId) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("id", sql.Int, id)
    .input("label", sql.NVarChar(100), field.label)
    .input("isRequired", sql.Bit, field.isRequired ? 1 : 0)
    .input("optionsJson", sql.NVarChar(sql.MAX), serializeOptions(field.options))
    .input("sortOrder", sql.Int, field.sortOrder)
    .input("isActive", sql.Bit, field.isActive ? 1 : 0)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE CustomFieldDefinitions SET
        Label = @label, IsRequired = @isRequired, OptionsJson = @optionsJson,
        SortOrder = @sortOrder, IsActive = @isActive,
        UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      OUTPUT INSERTED.Id, INSERTED.CompanyId, INSERTED.EntityType, INSERTED.FieldKey,
        INSERTED.Label, INSERTED.DataType, INSERTED.IsRequired, INSERTED.OptionsJson,
        INSERTED.SortOrder, INSERTED.IsActive
      WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.recordset[0] || null;
}

async function softDelete(companyId, id, userId) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .input("id", sql.Int, id)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE CustomFieldDefinitions SET
        IsDeleted = 1, IsActive = 0, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.rowsAffected[0] > 0;
}

module.exports = {
  list, findById, insert, update, softDelete,
};
