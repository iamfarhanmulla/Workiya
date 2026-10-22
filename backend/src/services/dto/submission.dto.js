const { toIso, toNumber, parseJsonObject } = require("./activity.dto");

function toSubmissionDto(row) {
  return {
    id: row.Id,
    companyId: row.CompanyId,
    activityId: row.ActivityId,
    activityTitle: row.ActivityTitle ?? null,
    accountName: row.AccountName ?? null,
    submittedBy: row.SubmittedBy,
    submittedByName: row.SubmittedByName ?? null,
    checkInAtUtc: toIso(row.CheckInAtUtc),
    checkInLatitude: toNumber(row.CheckInLatitude),
    checkInLongitude: toNumber(row.CheckInLongitude),
    checkOutAtUtc: toIso(row.CheckOutAtUtc),
    checkOutLatitude: toNumber(row.CheckOutLatitude),
    checkOutLongitude: toNumber(row.CheckOutLongitude),
    photoUrl: row.PhotoUrl ?? null,
    signatureUrl: row.SignatureUrl ?? null,
    notes: row.Notes ?? null,
    rating: toNumber(row.Rating),
    answers: parseJsonObject(row.Answers),
    reviewStatus: row.ReviewStatus,
    reviewedBy: row.ReviewedBy ?? null,
    reviewedByName: row.ReviewedByName ?? null,
    reviewedAtUtc: toIso(row.ReviewedAtUtc),
    reviewComment: row.ReviewComment ?? null,
    submittedAtUtc: toIso(row.SubmittedAtUtc),
  };
}

module.exports = { toSubmissionDto };
