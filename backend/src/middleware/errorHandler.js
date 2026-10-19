const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

function isJsonSyntaxError(err) {
  return err instanceof SyntaxError && err.type === "entity.parse.failed";
}

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return fail(res, err.status, err.errorCode, err.message);
  }
  if (isJsonSyntaxError(err)) {
    return fail(res, 400, ERROR_CODES.INVALID_JSON, "Request body is not valid JSON.");
  }
  logger.error({ err, method: req.method, path: req.path }, "Unhandled request error");
  return fail(res, 500, ERROR_CODES.INTERNAL_ERROR, "Something went wrong. Please try again.");
}

module.exports = { errorHandler };
