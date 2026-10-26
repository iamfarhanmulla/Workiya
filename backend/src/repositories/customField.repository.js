const db = require("../config/db");

const COLUMNS = `id, company_id, entity_type, field_key, label, data_type, is_required,
  options_json, sort_order, is_active`;

// jsonb text for the options list: pg would send a JS array as a PostgreSQL array instead.
function serializeOptions(options) {
  return Array.isArray(options) ? JSON.stringify(options) : null;
}

// Values of the columns an update may change (also bound on insert).
function editableParams(field) {
  return {
    label: field.label,
    isRequired: Boolean(field.isRequired),
    optionsJson: serializeOptions(field.options),
    sortOrder: field.sortOrder,
    isActive: Boolean(field.isActive),
  };
}

async function list(companyId, { entityType = null, includeInactive = false } = {}) {
  const params = { companyId };
  const clauses = ["company_id = @companyId", "NOT is_deleted"];
  if (entityType) {
    params.entityType = entityType;
    clauses.push("entity_type = @entityType");
  }
  if (!includeInactive) {
    clauses.push("is_active");
  }
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
     FROM custom_field_definitions
     WHERE ${clauses.join(" AND ")}
     ORDER BY sort_order, label, id`,
    params,
  );
  return rows;
}

async function findById(companyId, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
     FROM custom_field_definitions
     WHERE id = @id AND company_id = @companyId AND NOT is_deleted`,
    { companyId, id },
  );
  return rows[0] || null;
}

async function insert(companyId, field, userId) {
  const { rows } = await db.query(
    `INSERT INTO custom_field_definitions
       (company_id, entity_type, field_key, label, data_type, is_required, options_json,
        sort_order, is_active, created_by, updated_by)
     VALUES
       (@companyId, @entityType, @fieldKey, @label, @dataType, @isRequired,
        @optionsJson::jsonb, @sortOrder, @isActive, @userId, @userId)
     RETURNING ${COLUMNS}`,
    {
      ...editableParams(field),
      companyId,
      entityType: field.entityType,
      fieldKey: field.fieldKey,
      dataType: field.dataType,
      userId,
    },
  );
  return rows[0];
}

async function update(companyId, id, field, userId) {
  const { rows } = await db.query(
    `UPDATE custom_field_definitions SET
       label = @label, is_required = @isRequired, options_json = @optionsJson::jsonb,
       sort_order = @sortOrder, is_active = @isActive,
       updated_at = now(), updated_by = @userId
     WHERE id = @id AND company_id = @companyId AND NOT is_deleted
     RETURNING ${COLUMNS}`,
    {
      ...editableParams(field), companyId, id, userId,
    },
  );
  return rows[0] || null;
}

async function softDelete(companyId, id, userId) {
  const { rowCount } = await db.query(
    `UPDATE custom_field_definitions SET
       is_deleted = true, is_active = false, updated_at = now(), updated_by = @userId
     WHERE id = @id AND company_id = @companyId AND NOT is_deleted`,
    { companyId, id, userId },
  );
  return rowCount > 0;
}

module.exports = {
  list, findById, insert, update, softDelete,
};
