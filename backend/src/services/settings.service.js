const terminologyRepository = require("../repositories/terminology.repository");
const customFieldRepository = require("../repositories/customField.repository");
const { isUniqueViolation } = require("../repositories/sqlErrors");
const auditService = require("./audit.service");
const AppError = require("../utils/AppError");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const { usesOptions } = require("../validators/settings.schemas");
const { toTerminologyDto, toCustomFieldDto } = require("./settingsDto");

const FIELD_ENTITY = "CustomFieldDefinition";
const IMMUTABLE_FIELD_KEYS = ["fieldKey", "entityType", "dataType"];

// ctx = { companyId, userId, ip, userAgent } built by the controller from the request.
function audit(ctx, eventType, entityType, entityId, oldValue, newValue) {
  return auditService.log({
    eventType,
    entityType,
    entityId,
    companyId: ctx.companyId,
    performedBy: ctx.userId,
    oldValue,
    newValue,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

function notFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, "Custom field not found.");
}

async function getTerminology(companyId) {
  return toTerminologyDto(await terminologyRepository.listByCompany(companyId));
}

async function updateTerminology(ctx, labels) {
  const before = await getTerminology(ctx.companyId);
  await terminologyRepository.upsertLabels(ctx.companyId, labels, ctx.userId);
  const after = { ...before, ...labels };
  await audit(
    ctx,
    AUDIT_EVENTS.TERMINOLOGY_UPDATED,
    "CompanyTerminology",
    ctx.companyId,
    before,
    after,
  );
  return after;
}

async function listCustomFields(companyId, filters) {
  const rows = await customFieldRepository.list(companyId, filters);
  return rows.map(toCustomFieldDto);
}

async function withConflictCheck(work, fieldKey) {
  try {
    return await work();
  } catch (err) {
    if (isUniqueViolation(err)) {
      const message = `A field with key "${fieldKey}" already exists.`;
      throw new AppError(409, ERROR_CODES.CONFLICT, message);
    }
    throw err;
  }
}

async function createCustomField(ctx, field) {
  const row = await withConflictCheck(
    () => customFieldRepository.insert(ctx.companyId, field, ctx.userId),
    field.fieldKey,
  );
  const dto = toCustomFieldDto(row);
  await audit(ctx, AUDIT_EVENTS.CUSTOM_FIELD_CREATED, FIELD_ENTITY, dto.id, null, dto);
  return dto;
}

function assertImmutable(existing, changes) {
  const changed = IMMUTABLE_FIELD_KEYS.filter(
    (key) => changes[key] !== undefined && changes[key] !== existing[key],
  );
  if (changed.length > 0) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_FAILED,
      `${changed.join(", ")} cannot be changed after the field is created.`,
    );
  }
}

// Applies a partial update onto the stored field and re-checks the options for its data type.
function mergeField(existing, changes) {
  const merged = {
    label: changes.label ?? existing.label,
    isRequired: changes.isRequired ?? existing.isRequired,
    options: changes.options === undefined ? existing.options : changes.options,
    sortOrder: changes.sortOrder ?? existing.sortOrder,
    isActive: changes.isActive ?? existing.isActive,
  };
  const hasOptions = Array.isArray(merged.options) && merged.options.length > 0;
  if (usesOptions(existing.dataType) && !hasOptions) {
    const message = "options: Options are required for this data type.";
    throw new AppError(400, ERROR_CODES.VALIDATION_FAILED, message);
  }
  return { ...merged, options: usesOptions(existing.dataType) ? merged.options : null };
}

async function updateCustomField(ctx, id, changes) {
  const row = await customFieldRepository.findById(ctx.companyId, id);
  if (!row) {
    throw notFound();
  }
  const existing = toCustomFieldDto(row);
  assertImmutable(existing, changes);
  const updatedRow = await customFieldRepository.update(
    ctx.companyId,
    id,
    mergeField(existing, changes),
    ctx.userId,
  );
  if (!updatedRow) {
    throw notFound();
  }
  const dto = toCustomFieldDto(updatedRow);
  await audit(ctx, AUDIT_EVENTS.CUSTOM_FIELD_UPDATED, FIELD_ENTITY, id, existing, dto);
  return dto;
}

async function deleteCustomField(ctx, id) {
  const row = await customFieldRepository.findById(ctx.companyId, id);
  if (!row || !(await customFieldRepository.softDelete(ctx.companyId, id, ctx.userId))) {
    throw notFound();
  }
  const before = toCustomFieldDto(row);
  await audit(ctx, AUDIT_EVENTS.CUSTOM_FIELD_DELETED, FIELD_ENTITY, id, before, null);
}

module.exports = {
  audit,
  getTerminology,
  updateTerminology,
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
};
