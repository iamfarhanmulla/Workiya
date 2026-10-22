const { connectDb, sql } = require("../config/db");
const { ROLES } = require("../constants/roles");

// Display name of a dbo.Users row (read only: Users is shared with another system).
function userNameSql(alias) {
  return `COALESCE(NULLIF(LTRIM(RTRIM(${alias}.DisplayName)), N''),
    NULLIF(LTRIM(RTRIM(CONCAT(${alias}.FirstName, N' ', ${alias}.LastName))), N''))`;
}

// LIKE pattern that matches the text literally (%, _ and [ are escaped with \).
function likePattern(text) {
  return `%${String(text).replace(/[\\%_[]/g, "\\$&")}%`;
}

// Row filter for a caller's scope: { companyId, unrestricted, userId }. A restricted scope
// without a company binds NULL and therefore matches nothing.
function scopeConditions(request, scope, columns) {
  const conditions = [`${columns.deleted} = 0`];
  if (!scope.unrestricted) {
    request.input("scopeCompanyId", sql.Int, scope.companyId);
    conditions.push(`${columns.company} = @scopeCompanyId`);
  }
  if (scope.userId) {
    request.input("scopeUserId", sql.Int, scope.userId);
    conditions.push(`${columns.user} = @scopeUserId`);
  }
  return conditions;
}

function pageInputs(request, { page, pageSize }) {
  request.input("offset", sql.Int, (page - 1) * pageSize);
  request.input("pageSize", sql.Int, pageSize);
}

const ACTIVITY_SCOPE = { deleted: "a.IsDeleted", company: "a.CompanyId", user: "a.AssignedTo" };

const ACTIVITY_JOINS = `
  FROM Activities a
  LEFT JOIN ActivityTypes t ON t.Id = a.ActivityTypeId
  LEFT JOIN Accounts acc ON acc.Id = a.AccountId
  LEFT JOIN Users ut ON ut.Id = a.AssignedTo
  LEFT JOIN Users ub ON ub.Id = a.AssignedBy`;

const LATEST_SUBMISSION = `
  OUTER APPLY (
    SELECT TOP 1 s.Id, s.ReviewStatus, s.SubmittedAtUtc
    FROM Submissions s
    WHERE s.ActivityId = a.Id AND s.CompanyId = a.CompanyId AND s.IsDeleted = 0
    ORDER BY s.SubmittedAtUtc DESC, s.Id DESC
  ) ls`;

const ACTIVITY_COLUMNS = `
  a.Id, a.CompanyId, a.ActivityTypeId, t.Name AS ActivityTypeName,
  a.AccountId, acc.Name AS AccountName,
  a.AssignedTo, ${userNameSql("ut")} AS AssignedToName,
  a.AssignedBy, ${userNameSql("ub")} AS AssignedByName,
  a.Title, a.Description, a.Status, a.Priority,
  a.DueAtUtc, a.CompletedAtUtc, a.CreatedAtUtc,
  ls.Id AS LatestSubmissionId, ls.ReviewStatus AS LatestSubmissionReviewStatus,
  ls.SubmittedAtUtc AS LatestSubmissionSubmittedAtUtc`;

const LIST_FILTERS = [
  ["status", sql.NVarChar(20), "a.Status = @status"],
  ["accountId", sql.Int, "a.AccountId = @accountId"],
  ["assignedTo", sql.Int, "a.AssignedTo = @assignedTo"],
  ["dateFrom", sql.DateTime2(3), "a.DueAtUtc >= @dateFrom"],
  ["dateTo", sql.DateTime2(3), "a.DueAtUtc <= @dateTo"],
];

function listConditions(request, scope, filters) {
  const conditions = scopeConditions(request, scope, ACTIVITY_SCOPE);
  LIST_FILTERS.forEach(([name, type, condition]) => {
    if (filters[name] !== undefined) {
      request.input(name, type, filters[name]);
      conditions.push(condition);
    }
  });
  if (filters.search) {
    request.input("search", sql.NVarChar(210), likePattern(filters.search));
    conditions.push("(a.Title LIKE @search ESCAPE N'\\' OR acc.Name LIKE @search ESCAPE N'\\')");
  }
  return conditions.join(" AND ");
}

async function list(scope, filters) {
  const pool = await connectDb();
  const request = pool.request();
  const where = listConditions(request, scope, filters);
  pageInputs(request, filters);
  const result = await request.query(`
    SELECT COUNT(*) AS Total ${ACTIVITY_JOINS} WHERE ${where};
    SELECT ${ACTIVITY_COLUMNS} ${ACTIVITY_JOINS} ${LATEST_SUBMISSION}
    WHERE ${where}
    ORDER BY a.CreatedAtUtc DESC, a.Id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `);
  return { total: result.recordsets[0][0].Total, rows: result.recordsets[1] };
}

async function findById(id, scope) {
  const pool = await connectDb();
  const request = pool.request().input("id", sql.Int, id);
  const where = scopeConditions(request, scope, ACTIVITY_SCOPE).join(" AND ");
  const result = await request.query(`
    SELECT ${ACTIVITY_COLUMNS} ${ACTIVITY_JOINS} ${LATEST_SUBMISSION}
    WHERE a.Id = @id AND ${where}
  `);
  return result.recordset[0] || null;
}

// Each reference passed as null is skipped (reported as OK); the rest must belong to companyId.
// The assignee must be an active EMPLOYEE or MANAGER of that company.
async function checkReferences(companyId, { accountId, activityTypeId, assignedTo }) {
  const pool = await connectDb();
  const result = await pool.request()
    .input("companyId", sql.Int, companyId)
    .input("accountId", sql.Int, accountId ?? null)
    .input("activityTypeId", sql.Int, activityTypeId ?? null)
    .input("assignedTo", sql.Int, assignedTo ?? null)
    .input("employeeCode", sql.NVarChar(50), ROLES.EMPLOYEE)
    .input("managerCode", sql.NVarChar(50), ROLES.MANAGER)
    .query(`
      SELECT
        CASE WHEN @accountId IS NULL OR EXISTS (
          SELECT 1 FROM Accounts WHERE Id = @accountId AND CompanyId = @companyId
            AND IsActive = 1 AND IsDeleted = 0
        ) THEN 1 ELSE 0 END AS AccountOk,
        CASE WHEN @activityTypeId IS NULL OR EXISTS (
          SELECT 1 FROM ActivityTypes WHERE Id = @activityTypeId AND CompanyId = @companyId
            AND IsActive = 1 AND IsDeleted = 0
        ) THEN 1 ELSE 0 END AS ActivityTypeOk,
        CASE WHEN @assignedTo IS NULL OR EXISTS (
          SELECT 1 FROM Users u
          JOIN Roles r ON r.Id = u.RoleId AND r.IsDeleted = 0
          WHERE u.Id = @assignedTo AND u.CompanyId = @companyId
            AND u.IsActive = 1 AND u.IsDeleted = 0
            AND r.Code IN (@employeeCode, @managerCode)
        ) THEN 1 ELSE 0 END AS AssigneeOk
    `);
  const row = result.recordset[0] || {};
  return Boolean(row.AccountOk && row.ActivityTypeOk && row.AssigneeOk);
}

function bindFields(request, fields) {
  return request
    .input("activityTypeId", sql.Int, fields.activityTypeId)
    .input("accountId", sql.Int, fields.accountId)
    .input("assignedTo", sql.Int, fields.assignedTo)
    .input("title", sql.NVarChar(300), fields.title)
    .input("description", sql.NVarChar(2000), fields.description ?? null)
    .input("priority", sql.NVarChar(10), fields.priority)
    .input("dueAtUtc", sql.DateTime2(3), fields.dueAtUtc ? new Date(fields.dueAtUtc) : null);
}

async function insert(companyId, fields, userId) {
  const pool = await connectDb();
  const request = bindFields(pool.request(), fields)
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId);
  const result = await request.query(`
    INSERT INTO Activities
      (CompanyId, ActivityTypeId, AccountId, AssignedTo, AssignedBy, Title, Description,
       Status, Priority, DueAtUtc, CreatedBy, UpdatedBy)
    OUTPUT INSERTED.Id
    VALUES
      (@companyId, @activityTypeId, @accountId, @assignedTo, @userId, @title, @description,
       N'Pending', @priority, @dueAtUtc, @userId, @userId)
  `);
  return result.recordset[0].Id;
}

async function update(id, companyId, fields, userId) {
  const pool = await connectDb();
  const request = bindFields(pool.request(), fields)
    .input("id", sql.Int, id)
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId);
  const result = await request.query(`
    UPDATE Activities SET
      ActivityTypeId = @activityTypeId, AccountId = @accountId, AssignedTo = @assignedTo,
      Title = @title, Description = @description, Priority = @priority, DueAtUtc = @dueAtUtc,
      UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
    WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
  `);
  return result.rowsAffected[0];
}

// Only moves the row if it still has fromStatus, so two concurrent changes cannot both win.
async function updateStatus(id, companyId, { fromStatus, toStatus }, userId) {
  const pool = await connectDb();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("companyId", sql.Int, companyId)
    .input("fromStatus", sql.NVarChar(20), fromStatus)
    .input("toStatus", sql.NVarChar(20), toStatus)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE Activities SET
        Status = @toStatus,
        CompletedAtUtc = CASE WHEN @toStatus = N'Completed'
          THEN COALESCE(CompletedAtUtc, GETUTCDATE()) ELSE NULL END,
        UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      WHERE Id = @id AND CompanyId = @companyId AND Status = @fromStatus AND IsDeleted = 0
    `);
  return result.rowsAffected[0];
}

async function softDelete(id, companyId, userId) {
  const pool = await connectDb();
  const result = await pool.request()
    .input("id", sql.Int, id)
    .input("companyId", sql.Int, companyId)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE Activities SET IsDeleted = 1, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.rowsAffected[0];
}

module.exports = {
  userNameSql,
  likePattern,
  scopeConditions,
  pageInputs,
  list,
  findById,
  checkReferences,
  insert,
  update,
  updateStatus,
  softDelete,
};
