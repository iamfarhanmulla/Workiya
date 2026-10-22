const { z } = require("zod");

// An absolute http(s) URL with a host, or a path on this app's own origin. Protocol-relative
// ("//host") and backslash ("/\host") forms are refused: browsers resolve both to another
// site. javascript:, data: and other schemes never match.
const SAFE_URL_PATTERN = /^(https?:\/\/[^\s/\\]\S*|\/(?![/\\])\S*)$/i;

const SAFE_URL_MESSAGE = "Must be an http(s) URL or a /path.";

// Trims, turns "" and a missing value into null and accepts only a safe URL of at most `max`
// characters.
function safeUrl(max = 500) {
  return z.preprocess(
    (value) => (value === undefined || (typeof value === "string" && value.trim() === "")
      ? null : value),
    z.string().trim().max(max).regex(SAFE_URL_PATTERN, SAFE_URL_MESSAGE)
      .nullable(),
  );
}

module.exports = { SAFE_URL_PATTERN, safeUrl };
