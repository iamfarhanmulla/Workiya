const activityRepository = require("../repositories/activity.repository");
const { isForeignKeyViolation } = require("../repositories/sqlErrors");
const audit = require("./audit.service");
const { requireCompanyId } = require("./companyContext");
const { isSuperAdmin, resolveCompanyId, toId } = require("./tenantScope");
const { toActivityDto } = require("./dto/activity.dto");
const { ROLES } = require("../constants/roles");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const AppError = require("../utils/AppError");

const ENTITY_TYPE = "Activity";
const STAFF_ROLES = new Set([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER]);
const ALL_STATUSES = new Set(["Pending", "InProgress", "Completed", "Cancelled", "Missed"]);
// Field users may only start an activity or put it back; completion happens by submitting.
const EMPLOYEE_TRANSITIONS = Object.freeze({ Pending: ["InProgress"], InProgress: ["Pending"] });

function isStaff(user) {
  return Boolean(user) && STAFF_ROLES.has(user.roleCode);
}

// Rows the caller may see: SUPER_ADMIN everything (or one company), staff their company,
// everyone else only rows tied to themselves (AssignedTo / SubmittedBy).
function buildScope(user, requestedCompanyId) {
  const { allowed, companyId } = resolveCompanyId(user, requestedCompanyId);
  if (!allowed) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "You cannot access another company's data.");
  }
  return {
    companyId,
    unrestricted: isSuperAdmin(user) && companyId === null,
    userId: isStaff(user) ? null : toId(user.id),
  };
}

function canTransition(roleCode, fromStatus, toStatus) {
  if (STAFF_ROLES.has(roleCode)) {
    return ALL_STATUSES.has(toStatus);
  }
  return (EMPLOYEE_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function notFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, "Activity not found.");
}

function auditActivity(eventType, context, { row, oldValue, newValue }) {
  return audit.log({
    eventType,
    entityType: ENTITY_TYPE,
    entityId: row.id,
    companyId: row.company_id,
    performedBy: context.user.id,
    oldValue,
    newValue,
    ipAddress: context.ip,
    userAgent: context.userAgent,
  });
}

async function requireActivity(user, id) {
  const row = await activityRepository.findById(id, buildScope(user));
  if (!row) {
    throw notFound();
  }
  return row;
}

function crossCompanyReference() {
  return new AppError(
    400,
    ERROR_CODES.CROSS_COMPANY_REFERENCE,
    "Account, activity type and assignee must be active and belong to the activity's company.",
  );
}

async function assertReferences(companyId, references) {
  if (Object.values(references).every((value) => value === null || value === undefined)) {
    return;
  }
  if (!(await activityRepository.checkReferences(companyId, references))) {
    throw crossCompanyReference();
  }
}

// The (company_id, ...) foreign keys also tie account, type and assignee to the activity's
// company; a write they reject is reported like a failed reference check.
async function writeWithReferences(write) {
  try {
    return await write();
  } catch (err) {
    if (isForeignKeyViolation(err)) {
      throw crossCompanyReference();
    }
    throw err;
  }
}

async function listActivities(user, query) {
  const { companyId, ...filters } = query;
  const { total, rows } = await activityRepository.list(buildScope(user, companyId), filters);
  return {
    items: rows.map(toActivityDto), total, page: query.page, pageSize: query.pageSize,
  };
}

async function getActivity(user, id) {
  return toActivityDto(await requireActivity(user, id));
}

async function reload(id, companyId) {
  const row = await activityRepository.findById(id, { companyId, unrestricted: false });
  if (!row) {
    throw notFound();
  }
  return row;
}

async function createActivity(context, body) {
  const { companyId: requestedCompanyId, ...fields } = body;
  const companyId = requireCompanyId(context.user, requestedCompanyId);
  await assertReferences(companyId, fields);
  const id = await writeWithReferences(
    () => activityRepository.insert(companyId, fields, context.user.id),
  );
  const dto = toActivityDto(await reload(id, companyId));
  await auditActivity(AUDIT_EVENTS.ACTIVITY_CREATED, context, {
    row: { id, company_id: companyId }, oldValue: null, newValue: dto,
  });
  return dto;
}

function mergeFields(existing, body) {
  const pick = (key, column) => (body[key] !== undefined ? body[key] : existing[column]);
  return {
    activityTypeId: pick("activityTypeId", "activity_type_id"),
    accountId: pick("accountId", "account_id"),
    assignedTo: pick("assignedTo", "assigned_to"),
    title: pick("title", "title"),
    description: pick("description", "description"),
    priority: pick("priority", "priority"),
    dueAtUtc: pick("dueAtUtc", "due_at"),
  };
}

// Only references that change are re-checked, so an untouched account that was later
// deactivated does not block editing the title.
function changedReferences(existing, fields) {
  const changed = (key, column) => (fields[key] !== existing[column] ? fields[key] : null);
  return {
    accountId: changed("accountId", "account_id"),
    activityTypeId: changed("activityTypeId", "activity_type_id"),
    assignedTo: changed("assignedTo", "assigned_to"),
  };
}

async function updateActivity(context, id, body) {
  const existing = await requireActivity(context.user, id);
  const fields = mergeFields(existing, body);
  await assertReferences(existing.company_id, changedReferences(existing, fields));
  const updated = await writeWithReferences(
    () => activityRepository.update(id, existing.company_id, fields, context.user.id),
  );
  if (!updated) {
    throw notFound();
  }
  const dto = toActivityDto(await reload(id, existing.company_id));
  await auditActivity(AUDIT_EVENTS.ACTIVITY_UPDATED, context, {
    row: existing, oldValue: toActivityDto(existing), newValue: dto,
  });
  return dto;
}

async function changeActivityStatus(context, id, status) {
  const existing = await requireActivity(context.user, id);
  if (!canTransition(context.user.roleCode, existing.status, status)) {
    throw new AppError(
      422,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `You cannot move this activity from ${existing.status} to ${status}.`,
    );
  }
  const moved = await activityRepository.updateStatus(
    id,
    existing.company_id,
    { fromStatus: existing.status, toStatus: status },
    context.user.id,
  );
  if (!moved) {
    throw new AppError(409, ERROR_CODES.CONFLICT, "The activity just changed. Reload and retry.");
  }
  await auditActivity(AUDIT_EVENTS.ACTIVITY_STATUS_CHANGED, context, {
    row: existing, oldValue: { status: existing.status }, newValue: { status },
  });
  return toActivityDto(await reload(id, existing.company_id));
}

async function deleteActivity(context, id) {
  const existing = await requireActivity(context.user, id);
  if (!(await activityRepository.softDelete(id, existing.company_id, context.user.id))) {
    throw notFound();
  }
  await auditActivity(AUDIT_EVENTS.ACTIVITY_DELETED, context, {
    row: existing, oldValue: toActivityDto(existing), newValue: null,
  });
}

module.exports = {
  buildScope,
  canTransition,
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  changeActivityStatus,
  deleteActivity,
};
