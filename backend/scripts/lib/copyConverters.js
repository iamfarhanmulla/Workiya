// Value converters for the one-time SQL Server -> PostgreSQL copy (see copyMappings.js).
// A converter is (value, sourceRow) -> value. Problems are thrown as ConversionError with a
// message that never quotes the value, so reports cannot leak data.

class ConversionError extends Error {}

function asIs(value) {
  return value === undefined ? null : value;
}

// bigint arrives from mssql as a string; every id here is far below 2^53.
function toInteger(value) {
  return value === null || value === undefined ? null : Number(value);
}

// datetime2 (read as UTC) and datetimeoffset both arrive as JS Dates; strings are parsed.
function utc(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ConversionError("is not a valid date");
  }
  return new Date(date.getTime());
}

// updated_at is NOT NULL in PostgreSQL; rows never updated in SQL Server use created_at.
function updatedAt(value, row) {
  return utc(value ?? row.CreatedAtUtc);
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // The parser message quotes the value, which must not be printed.
    throw new ConversionError("is not valid JSON");
  }
}

// JSON text -> JSON text for a jsonb parameter (also correct for arrays, which pg would
// otherwise send as PostgreSQL arrays).
function json(value) {
  return value === null || value === undefined ? null : JSON.stringify(parseJson(value));
}

// Accounts.ExtraFields must be a JSON object (CHECK ck_accounts_extra_fields).
function jsonObject(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = parseJson(value);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ConversionError("is not a JSON object");
  }
  return JSON.stringify(parsed);
}

// Audit values: JSON text stays JSON; any other text is kept as a JSON string.
function jsonOrString(value) {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return JSON.stringify(String(value));
  }
}

module.exports = {
  ConversionError,
  asIs,
  toInteger,
  utc,
  updatedAt,
  json,
  jsonObject,
  jsonOrString,
};
