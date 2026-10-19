const crypto = require("crypto");

function legacyPbkdf2Row(password, overrides = {}) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");
  return {
    PasswordHash: hash.toString("base64"),
    PasswordSalt: salt.toString("base64"),
    PasswordIterations: 10000,
    ...overrides
  };
}

module.exports = { legacyPbkdf2Row };
