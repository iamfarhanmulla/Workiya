function toIso(value) {
  return value === undefined || value === null ? null : new Date(value).toISOString();
}

function toNumber(value) {
  return value === undefined || value === null ? null : Number(value);
}

// jsonb columns (answers) arrive as parsed values; anything but a JSON object reads as {}.
function toJsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toLatestSubmission(row) {
  if (row.latest_submission_id === undefined || row.latest_submission_id === null) {
    return null;
  }
  return {
    id: row.latest_submission_id,
    reviewStatus: row.latest_submission_review_status,
    submittedAtUtc: toIso(row.latest_submission_submitted_at),
  };
}

// Maps an activities row (snake_case) to the API shape (camelCase, ISO UTC dates).
function toActivityDto(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    activityTypeId: row.activity_type_id,
    activityTypeName: row.activity_type_name ?? null,
    accountId: row.account_id,
    accountName: row.account_name ?? null,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? null,
    assignedBy: row.assigned_by,
    assignedByName: row.assigned_by_name ?? null,
    title: row.title,
    description: row.description ?? null,
    status: row.status,
    priority: row.priority,
    dueAtUtc: toIso(row.due_at),
    completedAtUtc: toIso(row.completed_at),
    createdAtUtc: toIso(row.created_at),
    latestSubmission: toLatestSubmission(row),
  };
}

module.exports = {
  toActivityDto, toIso, toNumber, toJsonObject,
};
