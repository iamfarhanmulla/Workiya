const { z } = require("zod");

const ACTIVITY_STATUSES = ["Pending", "InProgress", "Completed", "Cancelled", "Missed"];
const PRIORITIES = ["Low", "Medium", "High"];

// Query strings send "" for an empty filter; treat it as "not given".
function optionalQuery(schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

const positiveId = z.coerce.number().int().positive();
const isoDateTime = z.iso.datetime({ offset: true });

// A date-only upper bound ("2026-10-31") includes that whole UTC day.
const dateFrom = z.union([z.iso.date(), isoDateTime])
  .transform((value) => new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value));
const dateTo = z.union([z.iso.date(), isoDateTime])
  .transform((value) => new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value));

const pagingQuery = {
  page: optionalQuery(z.coerce.number().int().min(1)).default(1),
  pageSize: optionalQuery(z.coerce.number().int().min(1).max(200)).default(50),
  search: optionalQuery(z.string().trim().max(200)),
  companyId: optionalQuery(positiveId),
};

const idParams = z.object({ id: positiveId });

const listActivitiesQuery = z.object({
  ...pagingQuery,
  status: optionalQuery(z.enum(ACTIVITY_STATUSES)),
  accountId: optionalQuery(positiveId),
  assignedTo: optionalQuery(positiveId),
  dateFrom: optionalQuery(dateFrom),
  dateTo: optionalQuery(dateTo),
});

const activityFields = {
  activityTypeId: z.number().int().positive(),
  accountId: z.number().int().positive(),
  assignedTo: z.number().int().positive(),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).nullable()
    .optional(),
  dueAtUtc: isoDateTime.nullable().optional(),
};

const createActivityBody = z.object({
  ...activityFields,
  companyId: z.number().int().positive().optional(),
  priority: z.enum(PRIORITIES).default("Medium"),
});

const updateActivityBody = z.object({
  ...activityFields,
  priority: z.enum(PRIORITIES),
}).partial().refine((body) => Object.keys(body).length > 0, {
  message: "Provide at least one field to update.",
});

const activityStatusBody = z.object({ status: z.enum(ACTIVITY_STATUSES) });

module.exports = {
  ACTIVITY_STATUSES,
  PRIORITIES,
  optionalQuery,
  pagingQuery,
  idParams,
  listActivitiesQuery,
  createActivityBody,
  updateActivityBody,
  activityStatusBody,
};
