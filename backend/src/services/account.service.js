const accountRepository = require("../repositories/account.repository");
const assignmentRepository = require("../repositories/accountAssignment.repository");
const auditService = require("./audit.service");
const customFieldsService = require("./customFields.service");
const { requireCompanyId } = require("./companyContext");
const { isSuperAdmin, resolveCompanyId } = require("./tenantScope");
const { toAccountDto, toExtraFields } = require("./dto/account.dto");
const AppError = require("../utils/AppError");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const { ROLES } = require("../constants/roles");

const ENTITY_TYPE = "Account";
const CUSTOM_FIELD_ENTITY = "ACCOUNT";
const PROFILE_KEYS = [
  "name", "phoneNumber", "email", "address", "city", "state", "country",
  "latitude", "longitude", "photoUrl", "notes",
];

// Rows a caller may read: SUPER_ADMIN everything (or one chosen company), others their own
// company, and an EMPLOYEE only the accounts assigned to them.
function readScope(user, requestedCompanyId) {
  const company = resolveCompanyId(user, requestedCompanyId);
  if (!company.allowed) {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "You do not have access to this company.");
  }
  return {
    user,
    companyId: isSuperAdmin(user) ? company.companyId : null,
    assignedUserId: user.roleCode === ROLES.EMPLOYEE ? user.id : null,
  };
}

// Rows a staff member may change: their own company (SUPER_ADMIN: any).
function writeScope(user) {
  return { user, companyId: null, assignedUserId: null };
}

function groupByAccount(assignmentRows) {
  const groups = new Map();
  assignmentRows.forEach((row) => {
    const group = groups.get(row.account_id) || [];
    group.push(row);
    groups.set(row.account_id, group);
  });
  return groups;
}

// One assignments query for the whole page, grouped per account in memory.
async function withAssignments(rows) {
  const assignmentRows = await assignmentRepository.listByAccountIds(rows.map((row) => row.id));
  const groups = groupByAccount(assignmentRows);
  return rows.map((row) => toAccountDto(row, groups.get(row.id) || []));
}

async function loadAccount(id, scope) {
  const row = await accountRepository.findById(id, scope);
  if (!row) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Account not found.");
  }
  return row;
}

async function loadDto(id, scope) {
  const [dto] = await withAssignments([await loadAccount(id, scope)]);
  return dto;
}

// existing: the stored values on an update, so values of fields switched off are kept.
async function checkedExtraFields(companyId, values, existing) {
  const result = await customFieldsService.validateValues(
    companyId,
    CUSTOM_FIELD_ENTITY,
    values,
    { existing },
  );
  if (!result.ok) {
    throw new AppError(400, ERROR_CODES.INVALID_EXTRA_FIELDS, result.message);
  }
  return result.value;
}

function profileFields(body, extraFields) {
  const fields = { extraFields };
  PROFILE_KEYS.forEach((key) => {
    fields[key] = body[key] ?? null;
  });
  return fields;
}

// Audit snapshot of the account itself, without the assigned reps.
function snapshot(dto) {
  const { assignedUsers, ...account } = dto;
  return account;
}

function audit(eventType, user, ctx, entry) {
  return auditService.log({
    eventType,
    entityType: ENTITY_TYPE,
    entityId: entry.entityId,
    companyId: entry.companyId,
    performedBy: user.id,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
}

async function list(user, query) {
  const scope = readScope(user, query.companyId);
  const { total, rows } = await accountRepository.list(scope, query);
  return {
    items: await withAssignments(rows), total, page: query.page, pageSize: query.pageSize,
  };
}

async function getById(user, id) {
  return loadDto(id, readScope(user));
}

async function create(user, body, ctx) {
  const companyId = requireCompanyId(user, body.companyId);
  const fields = profileFields(body, await checkedExtraFields(companyId, body.extraFields));
  const id = await accountRepository.insert(companyId, fields, user.id);
  const dto = await loadDto(id, writeScope(user));
  await audit(AUDIT_EVENTS.ACCOUNT_CREATED, user, ctx, {
    entityId: id, companyId, newValue: snapshot(dto),
  });
  return dto;
}

async function update(user, id, body, ctx) {
  const scope = writeScope(user);
  const before = await loadAccount(id, scope);
  const extraFields = await checkedExtraFields(
    before.company_id,
    body.extraFields,
    toExtraFields(before.extra_fields),
  );
  const fields = profileFields(body, extraFields);
  if (await accountRepository.update(id, before.company_id, fields, user.id) === 0) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Account not found.");
  }
  const dto = await loadDto(id, scope);
  await audit(AUDIT_EVENTS.ACCOUNT_UPDATED, user, ctx, {
    entityId: id,
    companyId: before.company_id,
    oldValue: snapshot(toAccountDto(before)),
    newValue: snapshot(dto),
  });
  return dto;
}

async function setStatus(user, id, isActive, ctx) {
  const scope = writeScope(user);
  const before = await loadAccount(id, scope);
  if (await accountRepository.setStatus(id, before.company_id, isActive, user.id) === 0) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Account not found.");
  }
  await audit(AUDIT_EVENTS.ACCOUNT_STATUS_CHANGED, user, ctx, {
    entityId: id,
    companyId: before.company_id,
    oldValue: { isActive: Boolean(before.is_active) },
    newValue: { isActive },
  });
  return loadDto(id, scope);
}

// Soft-deletes the account and ends its assignments in one transaction.
async function remove(user, id, ctx) {
  const before = await loadAccount(id, writeScope(user));
  await accountRepository.withTransaction(async (tx) => {
    await accountRepository.softDelete(id, before.company_id, user.id, tx);
    await assignmentRepository.softDeleteForAccount(id, user.id, tx);
  });
  await audit(AUDIT_EVENTS.ACCOUNT_DELETED, user, ctx, {
    entityId: id, companyId: before.company_id, oldValue: snapshot(toAccountDto(before)),
  });
}

module.exports = {
  list, getById, create, update, setStatus, remove,
};
