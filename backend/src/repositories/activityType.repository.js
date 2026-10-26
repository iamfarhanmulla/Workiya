const db = require("../config/db");

const COLUMNS = `id, company_id, code, name, requires_check_in, geofence_meters, min_photos,
  requires_signature, requires_customer_otp, is_active`;

const OPEN_ACTIVITY_STATUSES = "'Pending', 'InProgress'";

// Values of the columns shared by insert and update.
function typeParams(type) {
  return {
    code: type.code,
    name: type.name,
    requiresCheckIn: Boolean(type.requiresCheckIn),
    geofenceMeters: type.geofenceMeters ?? null,
    minPhotos: type.minPhotos,
    requiresSignature: Boolean(type.requiresSignature),
    requiresCustomerOtp: Boolean(type.requiresCustomerOtp),
    isActive: Boolean(type.isActive),
  };
}

async function list(companyId, { includeInactive = false } = {}) {
  const activeOnly = includeInactive ? "" : " AND is_active";
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
     FROM activity_types
     WHERE company_id = @companyId AND NOT is_deleted${activeOnly}
     ORDER BY name, id`,
    { companyId },
  );
  return rows;
}

async function findById(companyId, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS}
     FROM activity_types
     WHERE id = @id AND company_id = @companyId AND NOT is_deleted`,
    { companyId, id },
  );
  return rows[0] || null;
}

async function insert(companyId, type, userId) {
  const { rows } = await db.query(
    `INSERT INTO activity_types
       (company_id, code, name, requires_check_in, geofence_meters, min_photos,
        requires_signature, requires_customer_otp, is_active, created_by, updated_by)
     VALUES
       (@companyId, @code, @name, @requiresCheckIn, @geofenceMeters, @minPhotos,
        @requiresSignature, @requiresCustomerOtp, @isActive, @userId, @userId)
     RETURNING ${COLUMNS}`,
    { ...typeParams(type), companyId, userId },
  );
  return rows[0];
}

async function update(companyId, id, type, userId) {
  const { rows } = await db.query(
    `UPDATE activity_types SET
       code = @code, name = @name, requires_check_in = @requiresCheckIn,
       geofence_meters = @geofenceMeters, min_photos = @minPhotos,
       requires_signature = @requiresSignature, requires_customer_otp = @requiresCustomerOtp,
       is_active = @isActive, updated_at = now(), updated_by = @userId
     WHERE id = @id AND company_id = @companyId AND NOT is_deleted
     RETURNING ${COLUMNS}`,
    {
      ...typeParams(type), companyId, id, userId,
    },
  );
  return rows[0] || null;
}

async function countOpenActivities(companyId, id) {
  const { rows } = await db.query(
    `SELECT COUNT(*) AS total
     FROM activities
     WHERE company_id = @companyId AND activity_type_id = @id AND NOT is_deleted
       AND status IN (${OPEN_ACTIVITY_STATUSES})`,
    { companyId, id },
  );
  return rows[0] ? rows[0].total : 0;
}

async function softDelete(companyId, id, userId) {
  const { rowCount } = await db.query(
    `UPDATE activity_types SET
       is_deleted = true, is_active = false, updated_at = now(), updated_by = @userId
     WHERE id = @id AND company_id = @companyId AND NOT is_deleted`,
    { companyId, id, userId },
  );
  return rowCount > 0;
}

module.exports = {
  list, findById, insert, update, countOpenActivities, softDelete,
};
