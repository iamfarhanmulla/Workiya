const activityTypeRepository = require("../repositories/activityType.repository");
const { isUniqueViolation } = require("../repositories/sqlErrors");
const AppError = require("../utils/AppError");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const { audit } = require("./settings.service");
const { toActivityTypeDto } = require("./settingsDto");

const ENTITY_TYPE = "ActivityType";

function notFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, "Activity type not found.");
}

async function withConflictCheck(work, code) {
  try {
    return await work();
  } catch (err) {
    if (isUniqueViolation(err)) {
      const message = `An activity type with code "${code}" already exists.`;
      throw new AppError(409, ERROR_CODES.CONFLICT, message);
    }
    throw err;
  }
}

async function listActivityTypes(companyId, filters) {
  const rows = await activityTypeRepository.list(companyId, filters);
  return rows.map(toActivityTypeDto);
}

async function createActivityType(ctx, type) {
  const row = await withConflictCheck(
    () => activityTypeRepository.insert(ctx.companyId, type, ctx.userId),
    type.code,
  );
  const dto = toActivityTypeDto(row);
  await audit(ctx, AUDIT_EVENTS.ACTIVITY_TYPE_CREATED, ENTITY_TYPE, dto.id, null, dto);
  return dto;
}

async function updateActivityType(ctx, id, type) {
  const row = await activityTypeRepository.findById(ctx.companyId, id);
  if (!row) {
    throw notFound();
  }
  const updatedRow = await withConflictCheck(
    () => activityTypeRepository.update(ctx.companyId, id, type, ctx.userId),
    type.code,
  );
  if (!updatedRow) {
    throw notFound();
  }
  const dto = toActivityTypeDto(updatedRow);
  const before = toActivityTypeDto(row);
  await audit(ctx, AUDIT_EVENTS.ACTIVITY_TYPE_UPDATED, ENTITY_TYPE, id, before, dto);
  return dto;
}

async function deleteActivityType(ctx, id) {
  const row = await activityTypeRepository.findById(ctx.companyId, id);
  if (!row) {
    throw notFound();
  }
  const openActivities = await activityTypeRepository.countOpenActivities(ctx.companyId, id);
  if (openActivities > 0) {
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      `This activity type is used by ${openActivities} open activities. Deactivate it instead.`,
    );
  }
  if (!(await activityTypeRepository.softDelete(ctx.companyId, id, ctx.userId))) {
    throw notFound();
  }
  const before = toActivityTypeDto(row);
  await audit(ctx, AUDIT_EVENTS.ACTIVITY_TYPE_DELETED, ENTITY_TYPE, id, before, null);
}

module.exports = {
  listActivityTypes, createActivityType, updateActivityType, deleteActivityType,
};
