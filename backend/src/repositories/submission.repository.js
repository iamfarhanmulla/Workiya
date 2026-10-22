const { connectDb, sql } = require("../config/db");
const logger = require("../utils/logger");
const {
  userNameSql, likePattern, scopeConditions, pageInputs,
} = require("./activity.repository");

const SUBMISSION_SCOPE = { deleted: "s.IsDeleted", company: "s.CompanyId", user: "s.SubmittedBy" };
const ACTIVITY_SCOPE = { deleted: "a.IsDeleted", company: "a.CompanyId", user: "a.AssignedTo" };

const SUBMISSION_JOINS = `
  FROM Submissions s
  LEFT JOIN Activities a ON a.Id = s.ActivityId
  LEFT JOIN Accounts acc ON acc.Id = a.AccountId
  LEFT JOIN Users sb ON sb.Id = s.SubmittedBy
  LEFT JOIN Users rv ON rv.Id = s.ReviewedBy`;

const SUBMISSION_COLUMNS = `
  s.Id, s.CompanyId, s.ActivityId, a.Title AS ActivityTitle, acc.Name AS AccountName,
  s.SubmittedBy, ${userNameSql("sb")} AS SubmittedByName,
  s.CheckInAtUtc, s.CheckInLatitude, s.CheckInLongitude,
  s.CheckOutAtUtc, s.CheckOutLatitude, s.CheckOutLongitude,
  s.PhotoUrl, s.SignatureUrl, s.Notes, s.Rating, s.Answers, s.ReviewStatus,
  s.ReviewedBy, ${userNameSql("rv")} AS ReviewedByName, s.ReviewedAtUtc, s.ReviewComment,
  s.SubmittedAtUtc`;

const LIST_FILTERS = [
  ["reviewStatus", sql.NVarChar(20), "s.ReviewStatus = @reviewStatus"],
  ["activityId", sql.Int, "s.ActivityId = @activityId"],
  ["submittedBy", sql.Int, "s.SubmittedBy = @submittedBy"],
];

function listConditions(request, scope, filters) {
  const conditions = scopeConditions(request, scope, SUBMISSION_SCOPE);
  LIST_FILTERS.forEach(([name, type, condition]) => {
    if (filters[name] !== undefined) {
      request.input(name, type, filters[name]);
      conditions.push(condition);
    }
  });
  if (filters.search) {
    request.input("search", sql.NVarChar(210), likePattern(filters.search));
    conditions.push("(a.Title LIKE @search ESCAPE N'\\' OR acc.Name LIKE @search ESCAPE N'\\'"
      + " OR s.Notes LIKE @search ESCAPE N'\\')");
  }
  return conditions.join(" AND ");
}

async function list(scope, filters) {
  const pool = await connectDb();
  const request = pool.request();
  const where = listConditions(request, scope, filters);
  pageInputs(request, filters);
  const result = await request.query(`
    SELECT COUNT(*) AS Total ${SUBMISSION_JOINS} WHERE ${where};
    SELECT ${SUBMISSION_COLUMNS} ${SUBMISSION_JOINS}
    WHERE ${where}
    ORDER BY s.SubmittedAtUtc DESC, s.Id DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `);
  return { total: result.recordsets[0][0].Total, rows: result.recordsets[1] };
}

async function findById(id, scope) {
  const pool = await connectDb();
  const request = pool.request().input("id", sql.Int, id);
  const where = scopeConditions(request, scope, SUBMISSION_SCOPE).join(" AND ");
  const result = await request.query(`
    SELECT ${SUBMISSION_COLUMNS} ${SUBMISSION_JOINS}
    WHERE s.Id = @id AND ${where}
  `);
  return result.recordset[0] || null;
}

// The activity with the rules of its type and its account's location, for submit checks.
async function findActivityForSubmission(activityId, scope) {
  const pool = await connectDb();
  const request = pool.request().input("activityId", sql.Int, activityId);
  const where = scopeConditions(request, scope, ACTIVITY_SCOPE).join(" AND ");
  const result = await request.query(`
    SELECT a.Id, a.CompanyId, a.AssignedTo, a.Status, a.Title,
      t.RequiresCheckIn, t.GeofenceMeters, t.MinPhotos, t.RequiresSignature, t.RequiresCustomerOtp,
      acc.Latitude AS AccountLatitude, acc.Longitude AS AccountLongitude
    FROM Activities a
    JOIN ActivityTypes t ON t.Id = a.ActivityTypeId
    LEFT JOIN Accounts acc ON acc.Id = a.AccountId
    WHERE a.Id = @activityId AND ${where}
  `);
  return result.recordset[0] || null;
}

// Runs work(transaction). Commits unless work returns { error }, in which case it rolls back
// and returns that result; a thrown error also rolls back and is rethrown.
async function runInTransaction(work) {
  const pool = await connectDb();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    const result = await work(transaction);
    if (result.error) {
      await transaction.rollback();
    } else {
      await transaction.commit();
    }
    return result;
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.warn({ err: rollbackErr }, "Transaction rollback failed");
    }
    throw err;
  }
}

// UPDLOCK + HOLDLOCK hold the activity row and the open-submission range until commit, so
// two parallel submits for one activity cannot both pass the duplicate check. HOLDLOCK on the
// type and account rows keeps their rules and location fixed until the submission is saved.
const LOCK_ACTIVITY_FOR_SUBMIT = `
  SELECT a.Status, a.AssignedTo,
    t.RequiresCheckIn, t.GeofenceMeters, t.MinPhotos, t.RequiresSignature, t.RequiresCustomerOtp,
    acc.Latitude AS AccountLatitude, acc.Longitude AS AccountLongitude,
    (SELECT COUNT(*) FROM Submissions s WITH (UPDLOCK, HOLDLOCK)
     WHERE s.ActivityId = a.Id AND s.CompanyId = a.CompanyId AND s.IsDeleted = 0
       AND s.ReviewStatus IN (N'Pending', N'Approved')) AS OpenSubmissions
  FROM Activities a WITH (UPDLOCK, HOLDLOCK)
  JOIN ActivityTypes t WITH (HOLDLOCK) ON t.Id = a.ActivityTypeId AND t.CompanyId = a.CompanyId
  LEFT JOIN Accounts acc WITH (HOLDLOCK) ON acc.Id = a.AccountId AND acc.CompanyId = a.CompanyId
  WHERE a.Id = @activityId AND a.CompanyId = @companyId AND a.IsDeleted = 0`;

const INSERT_SUBMISSION_AND_COMPLETE = `
  INSERT INTO Submissions
    (CompanyId, ActivityId, SubmittedBy, CheckInAtUtc, CheckInLatitude, CheckInLongitude,
     CheckOutAtUtc, CheckOutLatitude, CheckOutLongitude, PhotoUrl, SignatureUrl, Notes,
     Rating, Answers, ReviewStatus, SubmittedAtUtc, CreatedBy, UpdatedBy)
  OUTPUT INSERTED.Id
  VALUES
    (@companyId, @activityId, @userId, @checkInAtUtc, @checkInLatitude, @checkInLongitude,
     @checkOutAtUtc, @checkOutLatitude, @checkOutLongitude, @photoUrl, @signatureUrl, @notes,
     @rating, @answers, N'Pending', GETUTCDATE(), @userId, @userId);
  UPDATE Activities SET
    Status = N'Completed', CompletedAtUtc = GETUTCDATE(),
    UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
  WHERE Id = @activityId AND CompanyId = @companyId AND IsDeleted = 0;`;

function toDate(value) {
  return value ? new Date(value) : null;
}

function bindSubmission(request, values) {
  const coordinate = sql.Decimal(10, 7);
  return request
    .input("checkInAtUtc", sql.DateTime2(3), toDate(values.checkInAtUtc))
    .input("checkInLatitude", coordinate, values.checkInLatitude ?? null)
    .input("checkInLongitude", coordinate, values.checkInLongitude ?? null)
    .input("checkOutAtUtc", sql.DateTime2(3), toDate(values.checkOutAtUtc))
    .input("checkOutLatitude", coordinate, values.checkOutLatitude ?? null)
    .input("checkOutLongitude", coordinate, values.checkOutLongitude ?? null)
    .input("photoUrl", sql.NVarChar(500), values.photoUrl ?? null)
    .input("signatureUrl", sql.NVarChar(500), values.signatureUrl ?? null)
    .input("notes", sql.NVarChar(3000), values.notes ?? null)
    .input("rating", sql.TinyInt, values.rating ?? null)
    .input("answers", sql.NVarChar(sql.MAX), JSON.stringify(values.answers || {}));
}

// Inserts a Pending submission and completes the activity in one transaction.
// verify(lockedRow), when given, checks the locked type rules and account location and may
// throw, which rolls the transaction back.
// Returns { id } or { error: "NOT_FOUND" | "NOT_ASSIGNEE" | "STATUS" | "DUPLICATE" }.
async function createAndCompleteActivity({
  companyId, activityId, userId, values, verify,
}) {
  return runInTransaction(async (transaction) => {
    const lock = await transaction.request()
      .input("activityId", sql.Int, activityId)
      .input("companyId", sql.Int, companyId)
      .query(LOCK_ACTIVITY_FOR_SUBMIT);
    const activity = lock.recordset[0];
    if (!activity) return { error: "NOT_FOUND" };
    if (activity.AssignedTo !== userId) return { error: "NOT_ASSIGNEE" };
    if (!["Pending", "InProgress"].includes(activity.Status)) {
      return { error: "STATUS", status: activity.Status };
    }
    if (activity.OpenSubmissions > 0) return { error: "DUPLICATE" };
    if (verify) verify(activity);
    const inserted = await bindSubmission(transaction.request(), values)
      .input("activityId", sql.Int, activityId)
      .input("companyId", sql.Int, companyId)
      .input("userId", sql.Int, userId)
      .query(INSERT_SUBMISSION_AND_COMPLETE);
    return { id: inserted.recordset[0].Id, previousStatus: activity.Status };
  });
}

const REVIEW_UPDATE = `
  UPDATE Submissions SET
    ReviewStatus = @status, ReviewedBy = @userId, ReviewedAtUtc = GETUTCDATE(),
    ReviewComment = @comment, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
  WHERE Id = @id;
  IF @reopen = 1
    UPDATE Activities SET
      Status = N'InProgress', CompletedAtUtc = NULL,
      UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
    WHERE Id = @activityId AND CompanyId = @companyId AND IsDeleted = 0
      AND Status = N'Completed';`;

// Reviews a Pending submission. A rejection re-opens the activity (InProgress) in the same
// transaction, but only while it is still Completed: one staff cancelled or marked missed
// stays that way. Returns { companyId, activityId, activityStatus, reopened }
// or { error: "NOT_FOUND" | "STATUS" | "SELF_REVIEW" }.
async function review({
  id, scope, status, comment, userId,
}) {
  return runInTransaction(async (transaction) => {
    const request = transaction.request().input("id", sql.Int, id);
    const where = scopeConditions(request, scope, SUBMISSION_SCOPE).join(" AND ");
    const lock = await request.query(`
      SELECT s.CompanyId, s.ActivityId, s.SubmittedBy, s.ReviewStatus,
        a.Status AS ActivityStatus
      FROM Submissions s WITH (UPDLOCK, HOLDLOCK)
      JOIN Activities a WITH (UPDLOCK, HOLDLOCK) ON a.Id = s.ActivityId
      WHERE s.Id = @id AND ${where}
    `);
    const row = lock.recordset[0];
    if (!row) return { error: "NOT_FOUND" };
    if (row.SubmittedBy === userId) return { error: "SELF_REVIEW" };
    if (row.ReviewStatus !== "Pending") return { error: "STATUS", status: row.ReviewStatus };
    const reopened = status === "Rejected" && row.ActivityStatus === "Completed";
    await transaction.request()
      .input("reopen", sql.Bit, reopened ? 1 : 0)
      .input("id", sql.Int, id)
      .input("status", sql.NVarChar(20), status)
      .input("comment", sql.NVarChar(1000), comment ?? null)
      .input("userId", sql.Int, userId)
      .input("activityId", sql.Int, row.ActivityId)
      .input("companyId", sql.Int, row.CompanyId)
      .query(REVIEW_UPDATE);
    return {
      companyId: row.CompanyId,
      activityId: row.ActivityId,
      activityStatus: row.ActivityStatus,
      reopened,
    };
  });
}

module.exports = {
  list,
  findById,
  findActivityForSubmission,
  createAndCompleteActivity,
  review,
};
