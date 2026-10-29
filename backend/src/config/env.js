const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const NON_PRODUCTION_ENVS = Object.freeze(["development", "test"]);

dotenv.config({ path: path.join(BACKEND_ROOT, ".env"), quiet: true });

function resolveFromBackend(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(BACKEND_ROOT, filePath);
}

function loadKey(base64Name, pathName) {
  const base64Value = process.env[base64Name];
  if (base64Value) {
    return Buffer.from(base64Value, "base64").toString("utf8");
  }
  const keyPath = process.env[pathName];
  if (keyPath) {
    const resolved = resolveFromBackend(keyPath);
    // eslint-disable-next-line n/no-sync -- key file read once, on first use
    if (!fs.existsSync(resolved)) {
      throw new Error(
        `${pathName} points to a missing file. Run "npm run keys:generate --workspace backend".`,
      );
    }
    // eslint-disable-next-line n/no-sync -- key file read once, on first use
    return fs.readFileSync(resolved, "utf8");
  }
  throw new Error(
    `JWT key missing: set ${base64Name} (base64 PEM, from Azure Key Vault in production) `
    + `or ${pathName}.`,
  );
}

// Keys load on first use, so tools that never sign tokens (e.g. the migration runner)
// start without them.
function lazyKey(base64Name, pathName) {
  let cached = null;
  return () => {
    if (cached === null) {
      cached = loadKey(base64Name, pathName);
    }
    return cached;
  };
}

// Users are Workiya-only, so legacy PBKDF2 hashes are upgraded to Argon2id at login unless
// PASSWORD_REHASH_ON_LOGIN=false.
const passwordRehashOnLogin = process.env.PASSWORD_REHASH_ON_LOGIN !== "false";

// Unset NODE_ENV fails closed: only an explicit development/test value turns off Secure cookies.
const nodeEnv = process.env.NODE_ENV || "production";
const privateKey = lazyKey("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_PATH");
const publicKey = lazyKey("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_PATH");

const config = Object.freeze({
  nodeEnv,
  secureCookies: !NON_PRODUCTION_ENVS.includes(nodeEnv),
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0),
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  port: Number(process.env.PORT || 5000),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  // Bearer token Vercel Cron sends to /api/v1/jobs/*; unset = the job endpoints do not exist.
  cronSecret: process.env.CRON_SECRET || "",
  jwt: Object.freeze({
    get privateKey() {
      return privateKey();
    },
    get publicKey() {
      return publicKey();
    },
    issuer: "workiya-api",
    audience: "workiya-web",
    accessTtlSeconds: 900,
  }),
  refresh: Object.freeze({
    persistentDays: 30,
    sessionHours: 12,
    reuseGraceSeconds: 30,
  }),
  auth: Object.freeze({
    maxFailedLogins: 5,
    lockoutMinutes: 15,
    passwordRehashOnLogin,
  }),
  // DATABASE_URL: pooled URL used by the API. DATABASE_URL_DIRECT: direct URL for migrations
  // and the data copy. DATABASE_URL_TEST: separate database used only by integration tests.
  database: Object.freeze({
    url: process.env.DATABASE_URL || "",
    directUrl: process.env.DATABASE_URL_DIRECT || "",
    testUrl: process.env.DATABASE_URL_TEST || "",
  }),
});

module.exports = config;
