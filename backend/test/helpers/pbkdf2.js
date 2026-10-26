const crypto = require("node:crypto");

// A users row (snake_case) holding a legacy PBKDF2-SHA256 hash, as copied from SQL Server.
function legacyPbkdf2Row(password, overrides = {}) {
  const salt = crypto.randomBytes(16);
  // eslint-disable-next-line n/no-sync -- test fixture builder; one hash per fixture
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");
  return {
    password_hash: hash.toString("base64"),
    password_salt: salt.toString("base64"),
    password_iterations: 10000,
    ...overrides,
  };
}

module.exports = { legacyPbkdf2Row };
