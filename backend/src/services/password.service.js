const crypto = require("crypto");
const { promisify } = require("util");
const argon2 = require("argon2");

const pbkdf2 = promisify(crypto.pbkdf2);

const ARGON2_PREFIX = "$argon2";
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
});

const PASSWORD_SCHEMES = Object.freeze({ ARGON2ID: "argon2id", PBKDF2: "pbkdf2" });
const LEGACY_PBKDF2_ITERATIONS = 10000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

let dummyHashPromise = null;

function isArgon2Hash(passwordHash) {
  return typeof passwordHash === "string" && passwordHash.startsWith(ARGON2_PREFIX);
}

async function verifyPbkdf2(userRow, plain) {
  const expected = Buffer.from(userRow.PasswordHash || "", "base64");
  if (expected.length === 0 || !userRow.PasswordSalt) {
    return false;
  }
  const salt = Buffer.from(userRow.PasswordSalt, "base64");
  const actual = await pbkdf2(plain, salt, userRow.PasswordIterations, expected.length, "sha256");
  return crypto.timingSafeEqual(actual, expected);
}

async function verifyPassword(userRow, plain) {
  if (!userRow || typeof plain !== "string") {
    return false;
  }
  if (isArgon2Hash(userRow.PasswordHash)) {
    try {
      return await argon2.verify(userRow.PasswordHash, plain);
    } catch (_err) {
      return false;
    }
  }
  if (userRow.PasswordIterations > 0) {
    return verifyPbkdf2(userRow, plain);
  }
  return false;
}

async function hashPassword(plain) {
  const passwordHash = await argon2.hash(plain, ARGON2_OPTIONS);
  return { passwordHash, passwordSalt: "", passwordIterations: 0 };
}

// Hash for accounts created through the admin screens. It stays PBKDF2 while the other
// system that shares dbo.Users can only verify PBKDF2; switch to hashPassword once it can.
function hashForSharedUsersTable(plain) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(plain, salt, LEGACY_PBKDF2_ITERATIONS, 32, "sha256");
  return {
    passwordSalt: salt.toString("base64"),
    passwordHash: hash.toString("base64"),
    passwordIterations: LEGACY_PBKDF2_ITERATIONS
  };
}

function isAcceptablePassword(plain) {
  return typeof plain === "string" && plain.length >= MIN_PASSWORD_LENGTH && plain.length <= MAX_PASSWORD_LENGTH;
}

function needsRehash(userRow) {
  return !isArgon2Hash(userRow.PasswordHash) && userRow.PasswordIterations > 0;
}

async function dummyArgon2Verify() {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(crypto.randomBytes(32).toString("hex"), ARGON2_OPTIONS);
  }
  const dummyHash = await dummyHashPromise;
  await argon2.verify(dummyHash, crypto.randomBytes(16).toString("hex"));
}

// Burns the same CPU as a real check of the given scheme, so response time does not reveal
// whether an email exists. Pass the scheme that real users are stored with.
async function dummyVerify(scheme = PASSWORD_SCHEMES.ARGON2ID) {
  if (scheme === PASSWORD_SCHEMES.PBKDF2) {
    await pbkdf2(crypto.randomBytes(16).toString("hex"), crypto.randomBytes(16), LEGACY_PBKDF2_ITERATIONS, 32, "sha256");
    return false;
  }
  await dummyArgon2Verify();
  return false;
}

module.exports = {
  verifyPassword,
  hashPassword,
  hashForSharedUsersTable,
  isAcceptablePassword,
  needsRehash,
  dummyVerify,
  ARGON2_OPTIONS,
  PASSWORD_SCHEMES,
  MIN_PASSWORD_LENGTH
};
