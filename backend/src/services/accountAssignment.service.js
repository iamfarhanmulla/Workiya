const accountRepository = require("../repositories/account.repository");
const assignmentRepository = require("../repositories/accountAssignment.repository");
const auditService = require("./audit.service");
const { requireCompanyId } = require("./companyContext");
const { toAssignmentDto } = require("./dto/account.dto");
const { isUniqueViolation } = require("../repositories/sqlErrors");
const AppError = require("../utils/AppError");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");

function crossCompany(message) {
  return new AppError(400, ERROR_CODES.CROSS_COMPANY_REFERENCE, message);
}

// A replace and a transfer running at the same time can both insert the same (account, user)
// pair; the filtered unique index stops the second one, which is reported as a conflict.
async function inTransaction(work) {
  try {
    return await accountRepository.withTransaction(work);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(
        409,
        ERROR_CODES.CONFLICT,
        "The assignments changed in the meantime. Reload and try again.",
      );
    }
    throw err;
  }
}

// The account, if it is live and inside the caller's company (SUPER_ADMIN: any company).
async function loadAccount(user, accountId) {
  const account = await accountRepository.findById(accountId, { user });
  if (!account) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, "Account not found.");
  }
  return account;
}

// Every user must be an active EMPLOYEE or MANAGER of the company.
async function ensureAssignable(companyId, userIds) {
  const assignable = new Set(await assignmentRepository.findAssignableUserIds(companyId, userIds));
  const invalid = userIds.filter((id) => !assignable.has(id));
  if (invalid.length > 0) {
    throw crossCompany("Only active employees and managers of this company can be assigned"
      + ` (user ${invalid.join(", ")}).`);
  }
}

// Diff between the active rows and the wanted set: rows to end, reps to add, visits to change.
function planChanges(current, wanted) {
  const currentByUser = new Map(current.map((row) => [row.UserId, row]));
  const wantedUsers = new Set(wanted.map((item) => item.userId));
  return {
    removeIds: current.filter((row) => !wantedUsers.has(row.UserId)).map((row) => row.Id),
    add: wanted.filter((item) => !currentByUser.has(item.userId)),
    change: wanted
      .filter((item) => {
        const row = currentByUser.get(item.userId);
        return row && (row.VisitsPerMonth ?? null) !== item.visitsPerMonth;
      })
      .map((item) => ({
        id: currentByUser.get(item.userId).Id, visitsPerMonth: item.visitsPerMonth,
      })),
  };
}

function hasChanges(plan) {
  return plan.removeIds.length + plan.add.length + plan.change.length > 0;
}

// Requests on one transaction run one after another.
async function applyPlan(plan, account, performedBy, tx) {
  if (plan.removeIds.length > 0) {
    await assignmentRepository.softDeleteByIds(plan.removeIds, performedBy, tx);
  }
  if (plan.add.length > 0) {
    const rows = plan.add.map((item) => ({ ...item, accountId: account.Id }));
    await assignmentRepository.insertMany(account.CompanyId, rows, performedBy, tx);
  }
  await plan.change.reduce(
    (previous, item) => previous.then(() => assignmentRepository.updateVisits(
      item.id,
      item.visitsPerMonth,
      performedBy,
      tx,
    )),
    Promise.resolve(),
  );
}

function auditEntry(eventType, user, ctx, entry) {
  return auditService.log({
    eventType,
    performedBy: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    ...entry,
  });
}

function toAssignmentValue(rows) {
  return rows.map((row) => ({ userId: row.UserId, visitsPerMonth: row.VisitsPerMonth ?? null }));
}

async function list(user, accountId) {
  await loadAccount(user, accountId);
  const rows = await assignmentRepository.listByAccountIds([accountId]);
  return rows.map(toAssignmentDto);
}

// Replaces the account's set of reps: ends removed rows, adds new ones, updates visit targets.
async function replace(user, accountId, assignments, ctx) {
  const account = await loadAccount(user, accountId);
  await ensureAssignable(account.CompanyId, assignments.map((item) => item.userId));
  const outcome = await inTransaction(async (tx) => {
    const current = await assignmentRepository.lockActiveForAccount(accountId, tx);
    const plan = planChanges(current, assignments);
    await applyPlan(plan, account, user.id, tx);
    return { current, changed: hasChanges(plan) };
  });
  if (outcome.changed) {
    await auditEntry(AUDIT_EVENTS.ACCOUNT_ASSIGNMENTS_CHANGED, user, ctx, {
      entityType: "Account",
      entityId: accountId,
      companyId: account.CompanyId,
      oldValue: toAssignmentValue(outcome.current),
      newValue: assignments,
    });
  }
  const rows = await assignmentRepository.listByAccountIds([accountId]);
  return rows.map(toAssignmentDto);
}

// Moves fromUser's active assignments to toUser, skipping accounts toUser already covers.
async function moveAssignments(companyId, { fromUserId, toUserId }, performedBy, tx) {
  const fromRows = await assignmentRepository.lockActiveForUser(companyId, fromUserId, tx);
  const toRows = await assignmentRepository.lockActiveForUser(companyId, toUserId, tx);
  const covered = new Set(toRows.map((row) => row.AccountId));
  const moving = fromRows.filter((row) => !covered.has(row.AccountId));
  if (moving.length > 0) {
    const rows = moving.map((row) => ({
      accountId: row.AccountId, userId: toUserId, visitsPerMonth: row.VisitsPerMonth ?? null,
    }));
    await assignmentRepository.insertMany(companyId, rows, performedBy, tx);
  }
  if (fromRows.length > 0) {
    await assignmentRepository.softDeleteByIds(fromRows.map((row) => row.Id), performedBy, tx);
  }
  return {
    moved: moving.length,
    skipped: fromRows.length - moving.length,
    accountIds: fromRows.map((row) => row.AccountId),
  };
}

async function transfer(user, body, ctx) {
  const companyId = requireCompanyId(user, body.companyId);
  if (!(await assignmentRepository.isCompanyUser(companyId, body.fromUserId))) {
    throw crossCompany("The user to transfer from does not belong to this company.");
  }
  await ensureAssignable(companyId, [body.toUserId]);
  const result = await inTransaction((tx) => moveAssignments(companyId, body, user.id, tx));
  if (result.accountIds.length > 0) {
    await auditEntry(AUDIT_EVENTS.ACCOUNTS_TRANSFERRED, user, ctx, {
      entityType: "User",
      entityId: body.fromUserId,
      companyId,
      oldValue: { userId: body.fromUserId, accountIds: result.accountIds },
      newValue: { userId: body.toUserId, moved: result.moved, skipped: result.skipped },
    });
  }
  return { moved: result.moved };
}

module.exports = { list, replace, transfer };
