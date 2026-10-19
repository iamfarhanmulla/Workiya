const fs = require("fs");
const path = require("path");
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
    if (!fs.existsSync(resolved)) {
      throw new Error(`${pathName} points to a missing file. Run "npm run keys:generate --workspace backend".`);
    }
    return fs.readFileSync(resolved, "utf8");
  }
  throw new Error(
    `JWT key missing: set ${base64Name} (base64 PEM, from Azure Key Vault in production) or ${pathName}.`
  );
}

// Keys load on first use, so tools that never sign tokens (e.g. the migration runner) start without them.
function lazyKey(base64Name, pathName) {
  let cached = null;
  return () => {
    if (cached === null) {
      cached = loadKey(base64Name, pathName);
    }
    return cached;
  };
}

// The shared Users table is also read by another system that only understands PBKDF2.
function readRehashFlag() {
  if (process.env.PASSWORD_REHASH_ON_LOGIN !== "true") {
    return false;
  }
  if (process.env.PASSWORD_REHASH_SHARED_DB_ACK !== "true") {
    throw new Error(
      "PASSWORD_REHASH_ON_LOGIN=true rewrites hashes in the shared Users table. " +
      "Set PASSWORD_REHASH_SHARED_DB_ACK=true only after every system using that table can verify Argon2id."
    );
  }
  return true;
}

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
  jwt: Object.freeze({
    get privateKey() {
      return privateKey();
    },
    get publicKey() {
      return publicKey();
    },
    issuer: "workiya-api",
    audience: "workiya-web",
    accessTtlSeconds: 900
  }),
  refresh: Object.freeze({
    persistentDays: 30,
    sessionHours: 12,
    reuseGraceSeconds: 30
  }),
  auth: Object.freeze({
    maxFailedLogins: 5,
    lockoutMinutes: 15,
    passwordRehashOnLogin: readRehashFlag()
  }),
  mssql: Object.freeze({
    server: process.env.MSSQL_SERVER || "",
    database: process.env.MSSQL_DATABASE || "",
    user: process.env.MSSQL_USER || "",
    password: process.env.MSSQL_PASSWORD || "",
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === "true"
  })
});

module.exports = config;
