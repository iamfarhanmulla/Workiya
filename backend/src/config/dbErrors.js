// PostgreSQL SQLSTATE codes the application reacts to.
const SQLSTATE = Object.freeze({
  UNIQUE_VIOLATION: "23505",
  FOREIGN_KEY_VIOLATION: "23503",
  CHECK_VIOLATION: "23514",
});

function hasCode(err, code) {
  return Boolean(err) && err.code === code;
}

function isUniqueViolation(err) {
  return hasCode(err, SQLSTATE.UNIQUE_VIOLATION);
}

function isForeignKeyViolation(err) {
  return hasCode(err, SQLSTATE.FOREIGN_KEY_VIOLATION);
}

function isCheckViolation(err) {
  return hasCode(err, SQLSTATE.CHECK_VIOLATION);
}

module.exports = {
  SQLSTATE, isUniqueViolation, isForeignKeyViolation, isCheckViolation,
};
