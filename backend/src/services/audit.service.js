const auditLogRepository = require("../repositories/auditLog.repository");
const logger = require("../utils/logger");

function serialize(value) {
  if (value === undefined || value === null) {
    return null;
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

function toNullableString(value) {
  return value === undefined || value === null ? null : String(value);
}

async function log(entry) {
  try {
    await auditLogRepository.insert({
      eventType: entry.eventType,
      entityType: entry.entityType,
      entityId: toNullableString(entry.entityId),
      companyId: entry.companyId ?? null,
      performedBy: entry.performedBy ?? null,
      oldValue: serialize(entry.oldValue),
      newValue: serialize(entry.newValue),
      ipAddress: entry.ipAddress ? String(entry.ipAddress).slice(0, 45) : null,
      userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 500) : null
    });
  } catch (err) {
    logger.error({ err, eventType: entry.eventType }, "Failed to write audit log");
  }
}

module.exports = { log };
