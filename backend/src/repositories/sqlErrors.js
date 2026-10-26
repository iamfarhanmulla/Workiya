// PostgreSQL error checks (SQLSTATE 23505 / 23503 / 23514); kept so services can keep
// importing them from the repository layer.
const {
  isUniqueViolation, isForeignKeyViolation, isCheckViolation,
} = require("../config/dbErrors");

module.exports = { isUniqueViolation, isForeignKeyViolation, isCheckViolation };
