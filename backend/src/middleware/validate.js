const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

function formatIssues(issues) {
  return issues
    .map((issue) => {
      const field = issue.path.join(".");
      return field ? `${field}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

function validate(schema, source = "body") {
  return function validateRequest(req, res, next) {
    const result = schema.safeParse(req[source] === undefined ? {} : req[source]);
    if (!result.success) {
      return fail(res, 400, ERROR_CODES.VALIDATION_FAILED, formatIssues(result.error.issues));
    }
    if (source === "body") {
      req.body = result.data;
    } else {
      req.validated = { ...(req.validated || {}), [source]: result.data };
    }
    return next();
  };
}

module.exports = { validate };
