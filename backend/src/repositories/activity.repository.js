const db = require("../config/db");
const { ROLES } = require("../constants/roles");

// Display name of a users row: display_name, else "first last".
function userNameSql(alias) {
  return `COALESCE(NULLIF(btrim(${alias}.display_name), ''),
    NULLIF(btrim(concat(${alias}.first_name, ' ', ${alias}.last_name)), ''))`;
}

// ILIKE pattern that matches the text literally (\, % and _ are escaped with \).
function likePattern(text) {
  return `%${String(text).replace(/[\\%_]/g, "\\$&")}%`;
}

// Row filter for a caller's scope: { companyId, unrestricted, userId }. Adds the values it
// references to params. A restricted scope without a company binds NULL: matches nothing.
function scopeConditions(params, scope, columns) {
  const conditions = [`NOT ${columns.deleted}`];
  if (!scope.unrestricted) {
    Object.assign(params, { scopeCompanyId: scope.companyId });
    conditions.push(`${columns.company} = @scopeCompanyId`);
  }
  if (scope.userId) {
    Object.assign(params, { scopeUserId: scope.userId });
    conditions.push(`${columns.user} = @scopeUserId`);
  }
  return conditions;
}

// Adds simple "column = @name" style filters (given as [name, predicate]) that are set.
function filterConditions(params, definitions, filters) {
  return definitions.filter(([name]) => filters[name] !== undefined).map(([name, condition]) => {
    Object.assign(params, { [name]: filters[name] });
    return condition;
  });
}

// Runs the COUNT and the page query of a list and returns { total, rows }. "extra" is joined
// only into the page query (e.g. a LATERAL join that does not change the row count).
async function pagedList({
  from, extra = "", columns, where, orderBy,
}, params, { page, pageSize }) {
  const pageQueryParams = { ...params, offset: (page - 1) * pageSize, pageSize };
  const [count, pageRows] = await Promise.all([
    db.query(`SELECT COUNT(*) AS total ${from} WHERE ${where}`, params),
    db.query(`
      SELECT ${columns} ${from} ${extra}
      WHERE ${where}
      ORDER BY ${orderBy}
      OFFSET @offset LIMIT @pageSize`, pageQueryParams),
  ]);
  return { total: count.rows[0].total, rows: pageRows.rows };
}

const ACTIVITY_SCOPE = { deleted: "a.is_deleted", company: "a.company_id", user: "a.assigned_to" };

const ACTIVITY_JOINS = `
  FROM activities a
  LEFT JOIN activity_types t ON t.id = a.activity_type_id
  LEFT JOIN accounts acc ON acc.id = a.account_id
  LEFT JOIN users ut ON ut.id = a.assigned_to
  LEFT JOIN users ub ON ub.id = a.assigned_by`;

const LATEST_SUBMISSION = `
  LEFT JOIN LATERAL (
    SELECT s.id, s.review_status, s.submitted_at
    FROM submissions s
    WHERE s.activity_id = a.id AND s.company_id = a.company_id AND NOT s.is_deleted
    ORDER BY s.submitted_at DESC, s.id DESC
    LIMIT 1
  ) ls ON TRUE`;

const ACTIVITY_COLUMNS = `
  a.id, a.company_id, a.activity_type_id, t.name AS activity_type_name,
  a.account_id, acc.name AS account_name,
  a.assigned_to, ${userNameSql("ut")} AS assigned_to_name,
  a.assigned_by, ${userNameSql("ub")} AS assigned_by_name,
  a.title, a.description, a.status, a.priority,
  a.due_at, a.completed_at, a.created_at,
  a.source, to_char(a.plan_month, 'YYYY-MM') AS plan_month,
  ls.id AS latest_submission_id, ls.review_status AS latest_submission_review_status,
  ls.submitted_at AS latest_submission_submitted_at`;

const LIST_FILTERS = [
  ["status", "a.status = @status"],
  ["accountId", "a.account_id = @accountId"],
  ["assignedTo", "a.assigned_to = @assignedTo"],
  ["dateFrom", "a.due_at >= @dateFrom"],
  ["dateTo", "a.due_at <= @dateTo"],
];

function listConditions(params, scope, filters) {
  const conditions = [
    ...scopeConditions(params, scope, ACTIVITY_SCOPE),
    ...filterConditions(params, LIST_FILTERS, filters),
  ];
  if (filters.search) {
    Object.assign(params, { search: likePattern(filters.search) });
    conditions.push("(a.title ILIKE @search ESCAPE '\\' OR acc.name ILIKE @search ESCAPE '\\')");
  }
  return conditions.join(" AND ");
}

async function list(scope, filters) {
  const params = {};
  const where = listConditions(params, scope, filters);
  return pagedList({
    from: ACTIVITY_JOINS,
    extra: LATEST_SUBMISSION,
    columns: ACTIVITY_COLUMNS,
    where,
    orderBy: "a.created_at DESC, a.id DESC",
  }, params, filters);
}

async function findById(id, scope) {
  const params = { id };
  const where = scopeConditions(params, scope, ACTIVITY_SCOPE).join(" AND ");
  const result = await db.query(`
    SELECT ${ACTIVITY_COLUMNS} ${ACTIVITY_JOINS} ${LATEST_SUBMISSION}
    WHERE a.id = @id AND ${where}`, params);
  return result.rows[0] || null;
}

// Each reference passed as null is skipped (reported as OK); the rest must belong to companyId.
// The assignee must be an active EMPLOYEE or MANAGER of that company.
async function checkReferences(companyId, { accountId, activityTypeId, assignedTo }) {
  const result = await db.query(`
    SELECT
      (@accountId::int IS NULL OR EXISTS (
        SELECT 1 FROM accounts WHERE id = @accountId::int AND company_id = @companyId
          AND is_active AND NOT is_deleted
      )) AS account_ok,
      (@activityTypeId::int IS NULL OR EXISTS (
        SELECT 1 FROM activity_types WHERE id = @activityTypeId::int AND company_id = @companyId
          AND is_active AND NOT is_deleted
      )) AS activity_type_ok,
      (@assignedTo::int IS NULL OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON r.id = u.role_id AND NOT r.is_deleted
        WHERE u.id = @assignedTo::int AND u.company_id = @companyId
          AND u.is_active AND NOT u.is_deleted
          AND r.code IN (@employeeCode, @managerCode)
      )) AS assignee_ok`, {
    companyId,
    accountId: accountId ?? null,
    activityTypeId: activityTypeId ?? null,
    assignedTo: assignedTo ?? null,
    employeeCode: ROLES.EMPLOYEE,
    managerCode: ROLES.MANAGER,
  });
  const row = result.rows[0] || {};
  return Boolean(row.account_ok && row.activity_type_ok && row.assignee_ok);
}

function fieldParams(fields) {
  return {
    activityTypeId: fields.activityTypeId,
    accountId: fields.accountId,
    assignedTo: fields.assignedTo,
    title: fields.title,
    description: fields.description ?? null,
    priority: fields.priority,
    dueAt: fields.dueAtUtc ? new Date(fields.dueAtUtc) : null,
  };
}

async function insert(companyId, fields, userId) {
  const result = await db.query(`
    INSERT INTO activities
      (company_id, activity_type_id, account_id, assigned_to, assigned_by, title, description,
       status, priority, due_at, created_by, updated_by)
    VALUES
      (@companyId, @activityTypeId, @accountId, @assignedTo, @userId, @title, @description,
       'Pending', @priority, @dueAt, @userId, @userId)
    RETURNING id`, { ...fieldParams(fields), companyId, userId });
  return result.rows[0].id;
}

async function update(id, companyId, fields, userId) {
  const result = await db.query(`
    UPDATE activities SET
      activity_type_id = @activityTypeId, account_id = @accountId, assigned_to = @assignedTo,
      title = @title, description = @description, priority = @priority, due_at = @dueAt,
      updated_at = now(), updated_by = @userId
    WHERE id = @id AND company_id = @companyId AND NOT is_deleted`, {
    ...fieldParams(fields), id, companyId, userId,
  });
  return result.rowCount;
}

// Only moves the row if it still has fromStatus, so two concurrent changes cannot both win.
async function updateStatus(id, companyId, { fromStatus, toStatus }, userId) {
  const result = await db.query(`
    UPDATE activities SET
      status = @toStatus::varchar,
      completed_at = CASE WHEN @toStatus::varchar = 'Completed'
        THEN COALESCE(completed_at, now()) ELSE NULL END,
      updated_at = now(), updated_by = @userId
    WHERE id = @id AND company_id = @companyId AND status = @fromStatus AND NOT is_deleted`, {
    id, companyId, fromStatus, toStatus, userId,
  });
  return result.rowCount;
}

async function softDelete(id, companyId, userId) {
  const result = await db.query(`
    UPDATE activities SET is_deleted = true, updated_at = now(), updated_by = @userId
    WHERE id = @id AND company_id = @companyId AND NOT is_deleted`, { id, companyId, userId });
  return result.rowCount;
}

module.exports = {
  userNameSql,
  likePattern,
  scopeConditions,
  filterConditions,
  pagedList,
  list,
  findById,
  checkReferences,
  insert,
  update,
  updateStatus,
  softDelete,
};
