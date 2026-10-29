const { z } = require("zod");

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must look like 2026-11");
const positiveId = z.coerce.number().int().positive();

function optionalQuery(schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

const planBody = z.object({
  month,
  activityTypeId: positiveId.optional(),
  companyId: positiveId.optional(),
}).strict();

const markMissedBody = z.object({ companyId: positiveId.optional() }).strict();

const coverageQuery = z.object({
  month: optionalQuery(month),
  companyId: optionalQuery(positiveId),
});

const trendQuery = z.object({
  weeks: optionalQuery(z.coerce.number().int().min(1).max(26)),
  companyId: optionalQuery(positiveId),
});

module.exports = {
  planBody, markMissedBody, coverageQuery, trendQuery,
};
