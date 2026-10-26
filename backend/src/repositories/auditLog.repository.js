const db = require("../config/db");

// old_value / new_value are jsonb. audit.service sends JSON text; any other text is stored
// as a JSON string, so an audit row is never lost to a parse error.
function toJsonText(value) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return JSON.stringify(value);
  }
  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify(value);
  }
}

// audit_logs is append-only: the database rejects UPDATE, DELETE and TRUNCATE on it.
async function insert(entry) {
  await db.query(`
    INSERT INTO audit_logs
      (event_type, entity_type, entity_id, company_id, performed_by,
       old_value, new_value, ip_address, user_agent, created_by)
    VALUES
      (@eventType, @entityType, @entityId, @companyId, @performedBy,
       @oldValue::jsonb, @newValue::jsonb, @ipAddress, @userAgent, @performedBy)
  `, {
    eventType: entry.eventType,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    companyId: entry.companyId ?? null,
    performedBy: entry.performedBy ?? null,
    oldValue: toJsonText(entry.oldValue),
    newValue: toJsonText(entry.newValue),
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
  });
}

module.exports = { insert };
