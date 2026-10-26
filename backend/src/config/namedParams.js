// Compiles "@name" placeholders to PostgreSQL "$1..$n" positional parameters.
// Skipped, so an "@" inside them is never a parameter: single-quoted literals ('' escapes),
// double-quoted identifiers, -- and /* */ comments, dollar-quoted bodies ($$ ... $$,
// $tag$ ... $tag$) and the "@@" operator. "::" casts after a parameter (@id::int) work because
// a name stops at the first character that is not a letter, digit or underscore.
const TOKEN = new RegExp([
  "'(?:[^']|'')*'",
  '"(?:[^"]|"")*"',
  "--[^\\n]*",
  "/\\*[\\s\\S]*?\\*/",
  "\\$([A-Za-z_][A-Za-z0-9_]*)?\\$[\\s\\S]*?\\$\\1\\$",
  "@@",
  "@([A-Za-z_][A-Za-z0-9_]*)",
].join("|"), "g");

const CACHE_LIMIT = 500;
const cache = new Map();

function parse(text) {
  const names = [];
  const positions = new Map();
  const compiled = text.replace(TOKEN, (match, _dollarTag, name) => {
    if (name === undefined) {
      return match;
    }
    if (!positions.has(name)) {
      names.push(name);
      positions.set(name, names.length);
    }
    return `$${positions.get(name)}`;
  });
  return { compiled, names };
}

function parseCached(text) {
  let parsed = cache.get(text);
  if (!parsed) {
    if (cache.size >= CACHE_LIMIT) {
      cache.clear();
    }
    parsed = parse(text);
    cache.set(text, parsed);
  }
  return parsed;
}

// Returns { text, values } for pg. Values are never inlined into the SQL text.
function compileNamed(text, params = {}) {
  const { compiled, names } = parseCached(text);
  const provided = new Set(Object.keys(params));
  const values = names.map((name) => {
    if (!provided.has(name)) {
      throw new Error(`SQL parameter "@${name}" is missing from params.`);
    }
    return params[name];
  });
  return { text: compiled, values };
}

module.exports = { compileNamed };
