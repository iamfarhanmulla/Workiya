const customFieldRepository = require("../repositories/customField.repository");

const MAX_TEXT_LENGTH = 1000;
const PHONE_PATTERN = /^[+0-9 ()-]{6,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EMAIL_LENGTH = 320;

function parseOptions(optionsJson) {
  if (!optionsJson) {
    return [];
  }
  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function isEmpty(value) {
  return value === undefined || value === null || value === ""
    || (Array.isArray(value) && value.length === 0);
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Each checker returns the stored value, or undefined when the value does not fit the type.
const CHECKERS = {
  TEXT: (v) => (typeof v === "string" && v.length <= MAX_TEXT_LENGTH ? v : undefined),
  NUMBER: (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined),
  DATE: (v) => (isValidDate(v) ? v : undefined),
  BOOLEAN: (v) => (typeof v === "boolean" ? v : undefined),
  SELECT: (v, options) => (typeof v === "string" && options.includes(v) ? v : undefined),
  MULTI_SELECT: (v, options) => (Array.isArray(v) && v.every((item) => options.includes(item))
    ? [...new Set(v)] : undefined),
  PHONE: (v) => (typeof v === "string" && PHONE_PATTERN.test(v) ? v : undefined),
  EMAIL: (v) => (typeof v === "string" && v.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(v)
    ? v : undefined),
};

const TYPE_HINTS = {
  TEXT: `text of at most ${MAX_TEXT_LENGTH} characters`,
  NUMBER: "a number",
  DATE: "a date in YYYY-MM-DD format",
  BOOLEAN: "true or false",
  SELECT: "one of the listed options",
  MULTI_SELECT: "a list of the listed options",
  PHONE: "a phone number (6-20 digits, spaces, +, -, brackets)",
  EMAIL: "an email address",
};

// Returns { value } for a usable value, {} for an empty optional field, or { error }.
function checkField(definition, rawValue) {
  if (isEmpty(rawValue)) {
    return definition.IsRequired ? { error: `${definition.Label} is required.` } : {};
  }
  const checker = CHECKERS[definition.DataType];
  const value = checker ? checker(rawValue, parseOptions(definition.OptionsJson)) : undefined;
  if (value === undefined) {
    const hint = TYPE_HINTS[definition.DataType] || "a valid value";
    return { error: `${definition.Label} must be ${hint}.` };
  }
  return { value };
}

// Own keys only: a field named like an Object.prototype member ("toString") must not read
// the inherited function as its value.
function ownValue(values, key) {
  return Object.getOwnPropertyDescriptor(values, key)?.value;
}

// Entries are collected and turned into an object with Object.fromEntries, which defines
// own properties, so a key such as "__proto__" can never reach the prototype setter.
function collectValues(definitions, values) {
  const entries = [];
  const errors = [];
  definitions.forEach((definition) => {
    const outcome = checkField(definition, ownValue(values, definition.FieldKey));
    if (outcome.error) {
      errors.push(outcome.error);
    } else if (outcome.value !== undefined) {
      entries.push([definition.FieldKey, outcome.value]);
    }
  });
  return { entries, errors };
}

function pickEntries(values, keep) {
  return Object.entries(values).filter(([key]) => keep(key));
}

// Checks custom field values (Accounts.ExtraFields, Submissions.Answers) against the company's
// active definitions. The returned value holds only defined, non-empty keys.
// options.existing (the stored values, on an update) are kept for fields that are inactive or
// deleted now, so switching a field off does not wipe its data; when `values` is undefined the
// stored values of the active fields are kept too.
async function validateValues(companyId, entityType, values, { existing } = {}) {
  if (values !== undefined && values !== null && !isPlainObject(values)) {
    return { ok: false, message: "Custom field values must be an object." };
  }
  const stored = isPlainObject(existing) ? existing : {};
  const definitions = await customFieldRepository.list(companyId, { entityType });
  const known = new Set(definitions.map((definition) => definition.FieldKey));
  let input = values ?? {};
  if (values === undefined) {
    input = Object.fromEntries(pickEntries(stored, (key) => known.has(key)));
  }
  const unknown = Object.keys(input).filter((key) => !known.has(key));
  if (unknown.length > 0) {
    return { ok: false, message: `Unknown field(s): ${unknown.join(", ")}.` };
  }
  const { entries, errors } = collectValues(definitions, input);
  if (errors.length > 0) {
    return { ok: false, message: errors.join(" ") };
  }
  const carried = pickEntries(stored, (key) => !known.has(key));
  return { ok: true, value: Object.fromEntries([...carried, ...entries]) };
}

module.exports = { validateValues, parseOptions };
