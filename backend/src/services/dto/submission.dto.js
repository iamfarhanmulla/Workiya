const { toIso, toNumber, toJsonObject } = require("./activity.dto");

// Maps a submissions row (snake_case) to the API shape (camelCase, ISO UTC dates).
function toSubmissionDto(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    activityId: row.activity_id,
    activityTitle: row.activity_title ?? null,
    accountName: row.account_name ?? null,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name ?? null,
    checkInAtUtc: toIso(row.check_in_at),
    checkInLatitude: toNumber(row.check_in_latitude),
    checkInLongitude: toNumber(row.check_in_longitude),
    checkOutAtUtc: toIso(row.check_out_at),
    checkOutLatitude: toNumber(row.check_out_latitude),
    checkOutLongitude: toNumber(row.check_out_longitude),
    photoUrl: row.photo_url ?? null,
    signatureUrl: row.signature_url ?? null,
    notes: row.notes ?? null,
    rating: toNumber(row.rating),
    answers: toJsonObject(row.answers),
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by ?? null,
    reviewedByName: row.reviewed_by_name ?? null,
    reviewedAtUtc: toIso(row.reviewed_at),
    reviewComment: row.review_comment ?? null,
    submittedAtUtc: toIso(row.submitted_at),
  };
}

module.exports = { toSubmissionDto };
