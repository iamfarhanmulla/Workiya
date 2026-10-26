const FALSE_TEXT = new Set(["0", "false", "no", "off", ""]);

// A boolean column value from a form field: true / false, 1 / 0 or their text forms.
// A missing value (undefined or null) gives `fallback`.
function toFlag(value, fallback = true) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "string") {
    return !FALSE_TEXT.has(value.trim().toLowerCase());
  }
  return Boolean(value);
}

module.exports = { toFlag };
