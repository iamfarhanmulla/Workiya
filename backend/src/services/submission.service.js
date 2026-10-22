const submissionRepository = require("../repositories/submission.repository");
const audit = require("./audit.service");
const customFields = require("./customFields.service");
const { buildScope } = require("./activity.service");
const { distanceMeters } = require("./geo");
const { toSubmissionDto } = require("./dto/submission.dto");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const AppError = require("../utils/AppError");

const SUBMITTABLE_STATUSES = new Set(["Pending", "InProgress"]);

function isSet(value) {
  return value !== undefined && value !== null && value !== "";
}

function submissionNotFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, "Submission not found.");
}

function activityNotFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, "Activity not found.");
}

function notAssignee() {
  return new AppError(
    403,
    ERROR_CODES.FORBIDDEN,
    "Only the user this activity is assigned to can submit it.",
  );
}

function notSubmittable(status) {
  return new AppError(
    422,
    ERROR_CODES.INVALID_STATUS_TRANSITION,
    `An activity that is ${status} cannot be submitted.`,
  );
}

function duplicate() {
  return new AppError(
    409,
    ERROR_CODES.CONFLICT,
    "This activity already has a submission that is pending review or approved.",
  );
}

function missing(message) {
  return new AppError(400, ERROR_CODES.VALIDATION_FAILED, message);
}

function unsupported(message) {
  return new AppError(422, ERROR_CODES.VALIDATION_FAILED, message);
}

// Rules a submission cannot meet yet: there is no customer OTP flow, and a submission holds
// a single photo. Such a type is reported plainly instead of being silently ignored.
function assertSupportedType(activity) {
  if (activity.RequiresCustomerOtp) {
    throw unsupported("This activity type requires customer OTP verification, which is not"
      + " available yet. Ask an admin to turn it off for this type.");
  }
  if (activity.MinPhotos > 1) {
    throw unsupported(`This activity type requires ${activity.MinPhotos} photos, but a`
      + " submission can hold only one. Ask an admin to lower the minimum.");
  }
}

// Evidence the activity type demands: check-in, photo, signature.
function assertTypeRequirements(activity, body) {
  assertSupportedType(activity);
  const hasCheckIn = isSet(body.checkInAtUtc)
    && isSet(body.checkInLatitude) && isSet(body.checkInLongitude);
  if (activity.RequiresCheckIn && !hasCheckIn) {
    throw missing("Check-in time and location are required for this activity type.");
  }
  if (activity.MinPhotos > 0 && !isSet(body.photoUrl)) {
    throw missing("A photo is required for this activity type.");
  }
  if (activity.RequiresSignature && !isSet(body.signatureUrl)) {
    throw missing("A signature is required for this activity type.");
  }
}

// With a geofence on the type, the check-in must be inside the fence. An account without a
// location cannot be checked, so the submit is refused instead of the fence being skipped.
function assertInsideGeofence(activity, body) {
  const fence = activity.GeofenceMeters;
  if (!fence) return;
  if (!isSet(activity.AccountLatitude) || !isSet(activity.AccountLongitude)) {
    throw new AppError(
      422,
      ERROR_CODES.OUTSIDE_GEOFENCE,
      "This activity type has a geofence, but the account has no location to check against."
        + " Ask a manager to set the account's location.",
    );
  }
  if (!isSet(body.checkInLatitude) || !isSet(body.checkInLongitude)) {
    throw missing("Check-in location is required for this activity type.");
  }
  const distance = distanceMeters(
    body.checkInLatitude,
    body.checkInLongitude,
    activity.AccountLatitude,
    activity.AccountLongitude,
  );
  if (distance > fence) {
    throw new AppError(
      422,
      ERROR_CODES.OUTSIDE_GEOFENCE,
      `Check-in is ${Math.round(distance)} m from the account; it must be within ${fence} m.`,
    );
  }
}

function assertSubmitRules(activity, body) {
  assertTypeRequirements(activity, body);
  assertInsideGeofence(activity, body);
}

async function validatedAnswers(companyId, answers) {
  const result = await customFields.validateValues(companyId, "SUBMISSION", answers);
  if (!result.ok) {
    throw new AppError(400, ERROR_CODES.INVALID_EXTRA_FIELDS, result.message);
  }
  return result.value;
}

const CREATE_ERRORS = {
  NOT_FOUND: activityNotFound,
  NOT_ASSIGNEE: notAssignee,
  STATUS: (result) => notSubmittable(result.status),
  DUPLICATE: duplicate,
};

function auditEntry(context, entry) {
  return audit.log({
    performedBy: context.user.id,
    ipAddress: context.ip,
    userAgent: context.userAgent,
    ...entry,
  });
}

async function reload(id, companyId) {
  const row = await submissionRepository.findById(id, { companyId, unrestricted: false });
  if (!row) {
    throw submissionNotFound();
  }
  return toSubmissionDto(row);
}

async function loadSubmittableActivity(user, activityId) {
  const activity = await submissionRepository.findActivityForSubmission(
    activityId,
    buildScope(user),
  );
  if (!activity) throw activityNotFound();
  if (activity.AssignedTo !== user.id) throw notAssignee();
  if (!SUBMITTABLE_STATUSES.has(activity.Status)) throw notSubmittable(activity.Status);
  return activity;
}

async function createSubmission(context, activityId, body) {
  const activity = await loadSubmittableActivity(context.user, activityId);
  assertSubmitRules(activity, body);
  const answers = await validatedAnswers(activity.CompanyId, body.answers);
  // The rules run again on the type and account rows locked inside the transaction, so a
  // change to either one while the rep submits cannot slip past them.
  const result = await submissionRepository.createAndCompleteActivity({
    companyId: activity.CompanyId,
    activityId,
    userId: context.user.id,
    values: { ...body, answers },
    verify: (locked) => assertSubmitRules(locked, body),
  });
  if (result.error) throw CREATE_ERRORS[result.error](result);
  const dto = await reload(result.id, activity.CompanyId);
  await auditEntry(context, {
    eventType: AUDIT_EVENTS.SUBMISSION_CREATED,
    entityType: "Submission",
    entityId: result.id,
    companyId: activity.CompanyId,
    newValue: dto,
  });
  await auditEntry(context, {
    eventType: AUDIT_EVENTS.ACTIVITY_STATUS_CHANGED,
    entityType: "Activity",
    entityId: activityId,
    companyId: activity.CompanyId,
    oldValue: { status: result.previousStatus },
    newValue: { status: "Completed", submissionId: result.id },
  });
  return dto;
}

async function reviewSubmission(context, id, { status, comment }) {
  const result = await submissionRepository.review({
    id, scope: buildScope(context.user), status, comment, userId: context.user.id,
  });
  if (result.error === "NOT_FOUND") throw submissionNotFound();
  if (result.error === "SELF_REVIEW") {
    throw new AppError(403, ERROR_CODES.FORBIDDEN, "You cannot review your own submission.");
  }
  if (result.error === "STATUS") {
    throw new AppError(
      422,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      `This submission is already ${result.status}; only Pending submissions can be reviewed.`,
    );
  }
  await auditEntry(context, {
    eventType: AUDIT_EVENTS.SUBMISSION_REVIEWED,
    entityType: "Submission",
    entityId: id,
    companyId: result.companyId,
    oldValue: { reviewStatus: "Pending" },
    newValue: { reviewStatus: status, comment: comment ?? null },
  });
  if (result.reopened) {
    await auditEntry(context, {
      eventType: AUDIT_EVENTS.ACTIVITY_STATUS_CHANGED,
      entityType: "Activity",
      entityId: result.activityId,
      companyId: result.companyId,
      oldValue: { status: result.activityStatus },
      newValue: { status: "InProgress", rejectedSubmissionId: id },
    });
  }
  return reload(id, result.companyId);
}

async function listSubmissions(user, query) {
  const { companyId, ...filters } = query;
  const { total, rows } = await submissionRepository.list(buildScope(user, companyId), filters);
  return {
    items: rows.map(toSubmissionDto), total, page: query.page, pageSize: query.pageSize,
  };
}

async function getSubmission(user, id) {
  const row = await submissionRepository.findById(id, buildScope(user));
  if (!row) {
    throw submissionNotFound();
  }
  return toSubmissionDto(row);
}

module.exports = {
  listSubmissions,
  getSubmission,
  createSubmission,
  reviewSubmission,
};
