const { ERROR_CODES } = require("../constants/errorCodes");
const { fail } = require("../utils/apiResponse");

function notFound(_req, res) {
  return fail(res, 404, ERROR_CODES.NOT_FOUND, "Resource not found.");
}

module.exports = { notFound };
