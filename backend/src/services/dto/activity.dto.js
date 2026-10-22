function toIso(value) {
  return value === undefined || value === null ? null : new Date(value).toISOString();
}

function toNumber(value) {
  return value === undefined || value === null ? null : Number(value);
}

// JSON columns (ExtraFields, Answers) are returned as objects; NULL or broken JSON becomes {}.
function parseJsonObject(text) {
  if (text === undefined || text === null || text === "") {
    return {};
  }
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toLatestSubmission(row) {
  if (row.LatestSubmissionId === undefined || row.LatestSubmissionId === null) {
    return null;
  }
  return {
    id: row.LatestSubmissionId,
    reviewStatus: row.LatestSubmissionReviewStatus,
    submittedAtUtc: toIso(row.LatestSubmissionSubmittedAtUtc),
  };
}

function toActivityDto(row) {
  return {
    id: row.Id,
    companyId: row.CompanyId,
    activityTypeId: row.ActivityTypeId,
    activityTypeName: row.ActivityTypeName ?? null,
    accountId: row.AccountId,
    accountName: row.AccountName ?? null,
    assignedTo: row.AssignedTo,
    assignedToName: row.AssignedToName ?? null,
    assignedBy: row.AssignedBy,
    assignedByName: row.AssignedByName ?? null,
    title: row.Title,
    description: row.Description ?? null,
    status: row.Status,
    priority: row.Priority,
    dueAtUtc: toIso(row.DueAtUtc),
    completedAtUtc: toIso(row.CompletedAtUtc),
    createdAtUtc: toIso(row.CreatedAtUtc),
    latestSubmission: toLatestSubmission(row),
  };
}

module.exports = {
  toActivityDto, toIso, toNumber, parseJsonObject,
};
