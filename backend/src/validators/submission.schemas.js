const { z } = require("zod");
const { optionalQuery, pagingQuery } = require("./activity.schemas");
const { safeUrl } = require("./common");

const REVIEW_STATUSES = ["Pending", "Approved", "Rejected"];
// Visit times come from the rep's device: allow a little clock skew into the future and a
// week of offline delay into the past, nothing more.
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const positiveId = z.coerce.number().int().positive();
const isoDateTime = z.iso.datetime({ offset: true }).nullable().optional();
const latitude = z.number().min(-90).max(90).nullable()
  .optional();
const longitude = z.number().min(-180).max(180).nullable()
  .optional();
// Absolute http(s) URLs or same-origin paths only, so a stored value can never be a
// javascript:, data: or off-site protocol-relative URL when the frontend renders it.
const fileUrl = safeUrl(500);

function bothOrNeither(body, ctx, [a, b]) {
  const hasA = body[a] !== undefined && body[a] !== null;
  const hasB = body[b] !== undefined && body[b] !== null;
  if (hasA !== hasB) {
    ctx.addIssue({ code: "custom", path: [hasA ? b : a], message: `Send ${a} and ${b} together.` });
  }
}

function checkOutAfterCheckIn(body, ctx) {
  if (body.checkInAtUtc && body.checkOutAtUtc
    && new Date(body.checkOutAtUtc) < new Date(body.checkInAtUtc)) {
    ctx.addIssue({
      code: "custom", path: ["checkOutAtUtc"], message: "Check-out cannot be before check-in.",
    });
  }
}

function withinVisitWindow(body, ctx, key) {
  if (!body[key]) return;
  const at = new Date(body[key]).getTime();
  const now = Date.now();
  if (at > now + MAX_FUTURE_SKEW_MS) {
    ctx.addIssue({ code: "custom", path: [key], message: "Cannot be in the future." });
  } else if (at < now - MAX_AGE_MS) {
    ctx.addIssue({ code: "custom", path: [key], message: "Cannot be more than 7 days ago." });
  }
}

const createSubmissionBody = z.object({
  checkInAtUtc: isoDateTime,
  checkInLatitude: latitude,
  checkInLongitude: longitude,
  checkOutAtUtc: isoDateTime,
  checkOutLatitude: latitude,
  checkOutLongitude: longitude,
  photoUrl: fileUrl,
  signatureUrl: fileUrl,
  notes: z.string().trim().max(3000).nullable()
    .optional(),
  rating: z.number().int().min(1).max(5)
    .nullable()
    .optional(),
  // Shape and content are checked against the company's SUBMISSION custom fields.
  answers: z.unknown().optional(),
}).superRefine((body, ctx) => {
  bothOrNeither(body, ctx, ["checkInLatitude", "checkInLongitude"]);
  bothOrNeither(body, ctx, ["checkOutLatitude", "checkOutLongitude"]);
  checkOutAfterCheckIn(body, ctx);
  withinVisitWindow(body, ctx, "checkInAtUtc");
  withinVisitWindow(body, ctx, "checkOutAtUtc");
});

const listSubmissionsQuery = z.object({
  ...pagingQuery,
  reviewStatus: optionalQuery(z.enum(REVIEW_STATUSES)),
  activityId: optionalQuery(positiveId),
  submittedBy: optionalQuery(positiveId),
});

const reviewSubmissionBody = z.object({
  status: z.enum(["Approved", "Rejected"]),
  comment: z.string().trim().max(1000).nullable()
    .optional(),
});

module.exports = {
  REVIEW_STATUSES,
  createSubmissionBody,
  listSubmissionsQuery,
  reviewSubmissionBody,
};
