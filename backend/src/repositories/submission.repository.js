const db = require("../config/db");
const {
  userNameSql, likePattern, scopeConditions, filterConditions, pagedList,
} = require("./activity.repository");

const SUBMISSION_SCOPE = {
  deleted: "s.is_deleted", company: "s.company_id", user: "s.submitted_by",
};
const ACTIVITY_SCOPE = { deleted: "a.is_deleted", company: "a.company_id", user: "a.assigned_to" };

const SUBMISSION_JOINS = `
  FROM submissions s
  LEFT JOIN activities a ON a.id = s.activity_id
  LEFT JOIN accounts acc ON acc.id = a.account_id
  LEFT JOIN users sb ON sb.id = s.submitted_by
  LEFT JOIN users rv ON rv.id = s.reviewed_by`;

const SUBMISSION_COLUMNS = `
  s.id, s.company_id, s.activity_id, a.title AS activity_title, acc.name AS account_name,
  s.submitted_by, ${userNameSql("sb")} AS submitted_by_name,
  s.check_in_at, s.check_in_latitude, s.check_in_longitude,
  s.check_out_at, s.check_out_latitude, s.check_out_longitude,
  s.photo_url, s.signature_url, s.notes, s.rating, s.answers, s.review_status,
  s.reviewed_by, ${userNameSql("rv")} AS reviewed_by_name, s.reviewed_at, s.review_comment,
  s.submitted_at`;

const LIST_FILTERS = [
  ["reviewStatus", "s.review_status = @reviewStatus"],
  ["activityId", "s.activity_id = @activityId"],
  ["submittedBy", "s.submitted_by = @submittedBy"],
];

function listConditions(params, scope, filters) {
  const conditions = [
    ...scopeConditions(params, scope, SUBMISSION_SCOPE),
    ...filterConditions(params, LIST_FILTERS, filters),
  ];
  if (filters.search) {
    Object.assign(params, { search: likePattern(filters.search) });
    conditions.push("(a.title ILIKE @search ESCAPE '\\' OR acc.name ILIKE @search ESCAPE '\\'"
      + " OR s.notes ILIKE @search ESCAPE '\\')");
  }
  return conditions.join(" AND ");
}

async function list(scope, filters) {
  const params = {};
  const where = listConditions(params, scope, filters);
  return pagedList({
    from: SUBMISSION_JOINS,
    columns: SUBMISSION_COLUMNS,
    where,
    orderBy: "s.submitted_at DESC, s.id DESC",
  }, params, filters);
}

async function findById(id, scope) {
  const params = { id };
  const where = scopeConditions(params, scope, SUBMISSION_SCOPE).join(" AND ");
  const result = await db.query(`
    SELECT ${SUBMISSION_COLUMNS} ${SUBMISSION_JOINS}
    WHERE s.id = @id AND ${where}`, params);
  return result.rows[0] || null;
}

const TYPE_RULE_COLUMNS = `t.requires_check_in, t.geofence_meters, t.min_photos,
  t.requires_signature, t.requires_customer_otp,
  acc.latitude AS account_latitude, acc.longitude AS account_longitude`;

// The activity with the rules of its type and its account's location, for submit checks.
async function findActivityForSubmission(activityId, scope) {
  const params = { activityId };
  const where = scopeConditions(params, scope, ACTIVITY_SCOPE).join(" AND ");
  const result = await db.query(`
    SELECT a.id, a.company_id, a.assigned_to, a.status, a.title, ${TYPE_RULE_COLUMNS}
    FROM activities a
    JOIN activity_types t ON t.id = a.activity_type_id
    LEFT JOIN accounts acc ON acc.id = a.account_id
    WHERE a.id = @activityId AND ${where}`, params);
  return result.rows[0] || null;
}

// FOR UPDATE holds the activity row until commit: every submit takes this lock first, so two
// parallel submits for one activity run one after the other.
const LOCK_ACTIVITY = `
  SELECT a.status, a.assigned_to, a.activity_type_id, a.account_id
  FROM activities a
  WHERE a.id = @activityId AND a.company_id = @companyId AND NOT a.is_deleted
  FOR UPDATE`;

// Runs after LOCK_ACTIVITY, so (in READ COMMITTED) it sees a submission committed by a submit
// that held the lock before. FOR SHARE keeps the type rules and account location fixed until
// the submission is saved.
const LOCKED_RULES = `
  SELECT ${TYPE_RULE_COLUMNS},
    (SELECT COUNT(*) FROM submissions s
     WHERE s.activity_id = @activityId AND s.company_id = @companyId AND NOT s.is_deleted
       AND s.review_status IN ('Pending', 'Approved')) AS open_submissions
  FROM activity_types t
  JOIN accounts acc ON acc.id = @accountId AND acc.company_id = @companyId
  WHERE t.id = @activityTypeId AND t.company_id = @companyId
  FOR SHARE OF t, acc`;

const INSERT_SUBMISSION = `
  INSERT INTO submissions
    (company_id, activity_id, submitted_by, check_in_at, check_in_latitude, check_in_longitude,
     check_out_at, check_out_latitude, check_out_longitude, photo_url, signature_url, notes,
     rating, answers, review_status, submitted_at, created_by, updated_by)
  VALUES
    (@companyId, @activityId, @userId, @checkInAt, @checkInLatitude, @checkInLongitude,
     @checkOutAt, @checkOutLatitude, @checkOutLongitude, @photoUrl, @signatureUrl, @notes,
     @rating, @answers, 'Pending', now(), @userId, @userId)
  RETURNING id`;

const COMPLETE_ACTIVITY = `
  UPDATE activities SET
    status = 'Completed', completed_at = now(), updated_at = now(), updated_by = @userId
  WHERE id = @activityId AND company_id = @companyId AND NOT is_deleted`;

function toDate(value) {
  return value ? new Date(value) : null;
}

function submissionParams(values) {
  return {
    checkInAt: toDate(values.checkInAtUtc),
    checkInLatitude: values.checkInLatitude ?? null,
    checkInLongitude: values.checkInLongitude ?? null,
    checkOutAt: toDate(values.checkOutAtUtc),
    checkOutLatitude: values.checkOutLatitude ?? null,
    checkOutLongitude: values.checkOutLongitude ?? null,
    photoUrl: values.photoUrl ?? null,
    signatureUrl: values.signatureUrl ?? null,
    notes: values.notes ?? null,
    rating: values.rating ?? null,
    answers: JSON.stringify(values.answers || {}),
  };
}

// Locks the activity, then reads its type rules and open submissions.
// Returns { error } when it cannot be submitted, else the locked row.
async function lockForSubmit(tx, keys, userId) {
  const lock = await tx.query(LOCK_ACTIVITY, keys);
  const activity = lock.rows[0];
  if (!activity) return { error: "NOT_FOUND" };
  if (activity.assigned_to !== userId) return { error: "NOT_ASSIGNEE" };
  if (!["Pending", "InProgress"].includes(activity.status)) {
    return { error: "STATUS", status: activity.status };
  }
  const rules = await tx.query(LOCKED_RULES, {
    ...keys, activityTypeId: activity.activity_type_id, accountId: activity.account_id,
  });
  const locked = { ...activity, ...rules.rows[0] };
  if (locked.open_submissions > 0) return { error: "DUPLICATE" };
  return { locked };
}

// Inserts a Pending submission and completes the activity in one transaction.
// verify(lockedRow), when given, checks the locked type rules and account location and may
// throw, which rolls the transaction back.
// Returns { id, previousStatus } or { error: "NOT_FOUND" | "NOT_ASSIGNEE" | "STATUS" |
// "DUPLICATE" } (nothing is written then).
async function createAndCompleteActivity({
  companyId, activityId, userId, values, verify,
}) {
  return db.withTransaction(async (tx) => {
    const keys = { activityId, companyId };
    const outcome = await lockForSubmit(tx, keys, userId);
    if (outcome.error) return outcome;
    const { locked } = outcome;
    if (verify) verify(locked);
    const inserted = await tx.query(INSERT_SUBMISSION, {
      ...submissionParams(values), ...keys, userId,
    });
    await tx.query(COMPLETE_ACTIVITY, { ...keys, userId });
    return { id: inserted.rows[0].id, previousStatus: locked.status };
  });
}

const REVIEW_UPDATE = `
  UPDATE submissions SET
    review_status = @status, reviewed_by = @userId, reviewed_at = now(),
    review_comment = @comment, updated_at = now(), updated_by = @userId
  WHERE id = @id`;

const REOPEN_ACTIVITY = `
  UPDATE activities SET
    status = 'InProgress', completed_at = NULL, updated_at = now(), updated_by = @userId
  WHERE id = @activityId AND company_id = @companyId AND NOT is_deleted
    AND status = 'Completed'`;

// Reviews a Pending submission. A rejection re-opens the activity (InProgress) in the same
// transaction, but only while it is still Completed: one staff cancelled or marked missed
// stays that way. Returns { companyId, activityId, activityStatus, reopened }
// or { error: "NOT_FOUND" | "STATUS" | "SELF_REVIEW" }.
async function review({
  id, scope, status, comment, userId,
}) {
  return db.withTransaction(async (tx) => {
    const params = { id };
    const where = scopeConditions(params, scope, SUBMISSION_SCOPE).join(" AND ");
    const lock = await tx.query(`
      SELECT s.company_id, s.activity_id, s.submitted_by, s.review_status,
        a.status AS activity_status
      FROM submissions s
      JOIN activities a ON a.id = s.activity_id AND a.company_id = s.company_id
      WHERE s.id = @id AND ${where}
      FOR UPDATE OF s, a`, params);
    const row = lock.rows[0];
    if (!row) return { error: "NOT_FOUND" };
    if (row.submitted_by === userId) return { error: "SELF_REVIEW" };
    if (row.review_status !== "Pending") return { error: "STATUS", status: row.review_status };
    const reopened = status === "Rejected" && row.activity_status === "Completed";
    await tx.query(REVIEW_UPDATE, {
      id, status, comment: comment ?? null, userId,
    });
    if (reopened) {
      await tx.query(REOPEN_ACTIVITY, {
        activityId: row.activity_id, companyId: row.company_id, userId,
      });
    }
    return {
      companyId: row.company_id,
      activityId: row.activity_id,
      activityStatus: row.activity_status,
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
