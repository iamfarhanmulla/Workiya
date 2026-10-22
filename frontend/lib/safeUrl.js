// Same rule as the backend (validators/common.js): an absolute http(s) URL with a host, or a
// path on this app's own origin. Protocol-relative ("//host") and backslash ("/\host") forms
// are refused because browsers resolve both to another site; javascript: and data: never match.
export const SAFE_URL_PATTERN = /^(https?:\/\/[^\s/\\]\S*|\/(?![/\\])\S*)$/i;

export function isSafeUrl(url) {
  return typeof url === "string" && SAFE_URL_PATTERN.test(url);
}
