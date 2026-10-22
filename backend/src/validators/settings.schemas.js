const { z } = require("zod");
const { TERM_KEYS } = require("../services/settingsDto");

const ENTITY_TYPES = ["ACCOUNT", "SUBMISSION"];
const DATA_TYPES = [
  "TEXT", "NUMBER", "DATE", "BOOLEAN", "SELECT", "MULTI_SELECT", "PHONE", "EMAIL",
];
const OPTION_TYPES = new Set(["SELECT", "MULTI_SELECT"]);
const MAX_OPTIONS = 100;
const MAX_SORT_ORDER = 100000;
// A submission holds one photo URL, so a type cannot demand more than one.
const MAX_MIN_PHOTOS = 1;
// Keys that collide with JavaScript object internals are refused as field keys.
const RESERVED_FIELD_KEYS = new Set([
  "__proto__", "constructor", "prototype",
  ...Object.getOwnPropertyNames(Object.prototype),
].map((key) => key.toLowerCase()));

// Form inputs may send numbers as strings; "" and null become null.
function toNullableNumber(value) {
  if (value === "" || value === null) {
    return null;
  }
  return typeof value === "string" ? Number(value) : value;
}

const intFrom = (min, max) => z.preprocess(toNullableNumber, z.number().int().min(min).max(max));
const nullableIntFrom = (min, max) => z.preprocess(
  toNullableNumber,
  z.number().int().min(min).max(max)
    .nullable(),
);
const positiveId = z.coerce.number().int().positive();
const label = z.string().trim().min(1, "Label is required.").max(100);
const queryFlag = z.enum(["true", "false"]).optional().transform((value) => value === "true");

const options = z.array(z.string().trim().min(1).max(100))
  .min(1, "At least one option is required.")
  .max(MAX_OPTIONS)
  .refine((list) => new Set(list).size === list.length, "Options must be unique.");

const idParamsSchema = z.object({ id: positiveId });

const companyQuerySchema = z.object({ companyId: positiveId.optional() });

const customFieldQuerySchema = companyQuerySchema.extend({
  entityType: z.enum(ENTITY_TYPES).optional(),
  includeInactive: queryFlag,
});

const activityTypeQuerySchema = companyQuerySchema.extend({ includeInactive: queryFlag });

const terminologySchema = z.object({
  companyId: positiveId.optional(),
  labels: z.strictObject(Object.fromEntries(TERM_KEYS.map((key) => [key, label.optional()])))
    .refine((labels) => Object.keys(labels).length > 0, "At least one label is required."),
});

function usesOptions(dataType) {
  return OPTION_TYPES.has(dataType);
}

// Options belong to SELECT/MULTI_SELECT only, and those two types need at least one.
function checkOptions(value, ctx) {
  const hasOptions = Array.isArray(value.options) && value.options.length > 0;
  if (usesOptions(value.dataType) && !hasOptions) {
    ctx.addIssue({
      code: "custom", path: ["options"], message: "Options are required for this data type.",
    });
  } else if (!usesOptions(value.dataType) && hasOptions) {
    ctx.addIssue({
      code: "custom",
      path: ["options"],
      message: "Options are only allowed for SELECT and MULTI_SELECT.",
    });
  }
}

const customFieldCreateSchema = z.object({
  companyId: positiveId.optional(),
  entityType: z.enum(ENTITY_TYPES),
  fieldKey: z.string().trim().min(1).max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, digits and underscores.")
    .refine((key) => !RESERVED_FIELD_KEYS.has(key.toLowerCase()), "This key is reserved."),
  label,
  dataType: z.enum(DATA_TYPES),
  isRequired: z.boolean().default(false),
  options: options.nullable().optional(),
  sortOrder: intFrom(0, MAX_SORT_ORDER).default(0),
  isActive: z.boolean().default(true),
}).superRefine(checkOptions);

// fieldKey, entityType and dataType may be echoed back but cannot change (checked in the service).
const customFieldUpdateSchema = z.object({
  companyId: positiveId.optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  fieldKey: z.string().trim().optional(),
  dataType: z.enum(DATA_TYPES).optional(),
  label: label.optional(),
  isRequired: z.boolean().optional(),
  options: options.nullable().optional(),
  sortOrder: intFrom(0, MAX_SORT_ORDER).optional(),
  isActive: z.boolean().optional(),
});

const activityTypeSchema = z.object({
  companyId: positiveId.optional(),
  code: z.string().trim().min(1).max(50)
    .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, digits, hyphens and underscores."),
  name: z.string().trim().min(1, "Name is required.").max(100),
  requiresCheckIn: z.boolean().default(true),
  geofenceMeters: nullableIntFrom(10, 5000).default(null),
  minPhotos: intFrom(0, MAX_MIN_PHOTOS).default(0),
  requiresSignature: z.boolean().default(false),
  // There is no customer OTP verification flow yet, so the rule cannot be switched on.
  requiresCustomerOtp: z.boolean().default(false)
    .refine((value) => !value, "Customer OTP verification is not available yet."),
  isActive: z.boolean().default(true),
});

module.exports = {
  usesOptions,
  idParamsSchema,
  companyQuerySchema,
  customFieldQuerySchema,
  activityTypeQuerySchema,
  terminologySchema,
  customFieldCreateSchema,
  customFieldUpdateSchema,
  activityTypeSchema,
};
