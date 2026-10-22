// SQL Server error numbers for a duplicate key in a unique index (2601) or constraint (2627).
const UNIQUE_VIOLATION_NUMBERS = new Set([2601, 2627]);

function isUniqueViolation(err) {
  return Boolean(err) && UNIQUE_VIOLATION_NUMBERS.has(err.number);
}

module.exports = { isUniqueViolation };
