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

// The returned middleware carries { schema, source } so the API docs can describe the input.
function validate(schema, source = "body") {
  function validateRequest(req, res, next) {
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
  }
  validateRequest.openapi = { schema, source };
  return validateRequest;
}

module.exports = { validate };
