const { z } = require("zod");
const { safeUrl } = require("./common");

const MAX_PAGE_SIZE = 200;
const MAX_ASSIGNMENTS = 200;

// Trims strings and turns "", null and a missing value into null.
function blankToNull(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value === undefined ? null : value;
}

// Form inputs may send numbers as strings; blanks become null.
function toNullableNumber(value) {
  const blank = blankToNull(value);
  return typeof blank === "string" ? Number(blank) : blank;
}

function toOptionalNumber(value) {
  const number = toNullableNumber(value);
  return number === null ? undefined : number;
}

const text = (max) => z.preprocess(blankToNull, z.string().max(max).nullable());
const coordinate = (limit) => z.preprocess(
  toNullableNumber,
  z.number().min(-limit).max(limit).nullable(),
);
const positiveId = z.coerce.number().int().positive();
const optionalId = z.preprocess(toOptionalNumber, z.number().int().positive().optional());

const accountUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  phoneNumber: text(30),
  email: z.preprocess(blankToNull, z.email().max(255).nullable()),
  address: text(500),
  city: text(100),
  state: text(100),
  country: text(100),
  latitude: coordinate(90),
  longitude: coordinate(180),
  // Rendered as a link or image by clients, so only http(s) URLs and app paths are stored.
  photoUrl: safeUrl(500),
  notes: text(1000),
  extraFields: z.unknown().optional(),
});

const accountCreateSchema = accountUpdateSchema.extend({ companyId: optionalId });

const accountStatusSchema = z.object({ isActive: z.boolean() });

const idParamsSchema = z.object({ id: positiveId });

const accountListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE)
    .default(50),
  search: z.preprocess(blankToNull, z.string().max(100).nullable()),
  isActive: z.enum(["true", "false"]).optional()
    .transform((v) => (v === undefined ? null : v === "true")),
  companyId: optionalId,
});

const assignmentSchema = z.object({
  userId: z.number().int().positive(),
  visitsPerMonth: z.number().int().min(1)
    .max(31)
    .nullish()
    .transform((v) => v ?? null),
});

const accountAssignmentsSchema = z.object({
  assignments: z.array(assignmentSchema).max(MAX_ASSIGNMENTS),
}).refine(
  (body) => new Set(body.assignments.map((a) => a.userId)).size === body.assignments.length,
  { message: "Each user may be assigned only once.", path: ["assignments"] },
);

const assignmentTransferSchema = z.object({
  fromUserId: z.number().int().positive(),
  toUserId: z.number().int().positive(),
  companyId: optionalId,
}).refine((body) => body.fromUserId !== body.toUserId, {
  message: "Choose a different user to transfer to.",
  path: ["toUserId"],
});

module.exports = {
  accountCreateSchema,
  accountUpdateSchema,
  accountStatusSchema,
  idParamsSchema,
  accountListQuerySchema,
  accountAssignmentsSchema,
  assignmentTransferSchema,
};
