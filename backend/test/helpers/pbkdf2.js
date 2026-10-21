const crypto = require("node:crypto");

function legacyPbkdf2Row(password, overrides = {}) {
  const salt = crypto.randomBytes(16);
  // eslint-disable-next-line n/no-sync -- test fixture builder; mirrors the sync production hash
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");
  return {
    PasswordHash: hash.toString("base64"),
    PasswordSalt: salt.toString("base64"),
    PasswordIterations: 10000,
    ...overrides,
  };
}

module.exports = { legacyPbkdf2Row };
