const path = require("node:path");
const { ROLES } = require("../src/constants/roles");
const passwordService = require("../src/services/password.service");

// Creates the first company and its SUPER_ADMIN on a fresh database (no copied data). Does
// nothing when a SUPER_ADMIN already exists. The email and password come from the environment
// (SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD); the password is never printed.
const DEFAULT_URL_ENV = "DATABASE_URL_DIRECT";
const DEFAULT_COMPANY_NAME = "Workiya";
const LOCK_KEY = "workiya.seed-super-admin";
const STANDARD_ROLES = Object.freeze([
  [ROLES.SUPER_ADMIN, "Super Admin"],
  [ROLES.ADMIN, "Admin"],
  [ROLES.EMPLOYEE, "Employee"],
  [ROLES.MANAGER, "Manager"],
]);
const USAGE = "Usage: SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... "
  + "node scripts/seed-super-admin.js [--yes] [--url-env <ENV_NAME>]\n";

function parseArgs(argv) {
  const args = argv.slice(2);
  const urlEnvIndex = args.indexOf("--url-env");
  return {
    confirmed: args.includes("--yes"),
    urlEnv: urlEnvIndex === -1 ? DEFAULT_URL_ENV : args[urlEnvIndex + 1],
  };
}

function companyKey(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Throws a readable message when an input is missing or too weak.
function readSeedInput(env) {
  const email = (env.SEED_ADMIN_EMAIL || "").trim();
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) {
    throw new Error("SEED_ADMIN_EMAIL must be set to an email address.");
  }
  if (!passwordService.isAcceptablePassword(env.SEED_ADMIN_PASSWORD)) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${passwordService.MIN_PASSWORD_LENGTH}`
      + " characters.");
  }
  const companyName = (env.SEED_COMPANY_NAME || DEFAULT_COMPANY_NAME).trim();
  return {
    email, password: env.SEED_ADMIN_PASSWORD, companyName, key: companyKey(companyName),
  };
}

async function findSuperAdmin(executor) {
  const { rows } = await executor.query(`
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.code = @superAdminCode AND NOT u.is_deleted
    ORDER BY u.id LIMIT 1`, { superAdminCode: ROLES.SUPER_ADMIN });
  return rows[0] ? rows[0].id : null;
}

async function ensureCompany(tx, { companyName, key }) {
  await tx.query(`
    INSERT INTO roles (code, name)
    SELECT * FROM unnest(@codes::varchar[], @names::varchar[])
    ON CONFLICT (code) DO NOTHING`, {
    codes: STANDARD_ROLES.map(([code]) => code),
    names: STANDARD_ROLES.map(([, name]) => name),
  });
  await tx.query(`
    INSERT INTO companies (name, key, plan) VALUES (@companyName, @key, 'STARTUP')
    ON CONFLICT (key) DO NOTHING`, { companyName, key });
  const { rows } = await tx.query("SELECT id FROM companies WHERE key = @key", { key });
  return rows[0].id;
}

async function insertSuperAdmin(tx, companyId, { email, hashed }) {
  const { rows } = await tx.query(`
    INSERT INTO users
      (company_id, role_id, username, first_name, last_name, display_name, email,
       password_hash, password_salt, password_iterations, status, is_active)
    VALUES
      (@companyId, (SELECT id FROM roles WHERE code = @superAdminCode), @username,
       'Super', 'Admin', 'Super Admin', @email,
       @passwordHash, @passwordSalt, @passwordIterations, 1, true)
    RETURNING id`, {
    companyId,
    superAdminCode: ROLES.SUPER_ADMIN,
    username: email.split("@")[0],
    email,
    ...hashed,
  });
  return rows[0].id;
}

// One transaction, serialised by an advisory lock so two runs cannot both create an admin.
async function seedSuperAdmin(db, input) {
  const hashed = await passwordService.hashPassword(input.password);
  return db.withTransaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtext(@lockKey))", { lockKey: LOCK_KEY });
    const existingId = await findSuperAdmin(tx);
    if (existingId !== null) {
      return { created: false, userId: existingId };
    }
    const companyId = await ensureCompany(tx, input);
    const userId = await insertSuperAdmin(tx, companyId, { email: input.email, hashed });
    return { created: true, userId, companyId };
  });
}

async function run(db, input, { confirmed, out }) {
  const existingId = await findSuperAdmin(db);
  if (existingId !== null) {
    out(`Nothing to do: a SUPER_ADMIN already exists (user id ${existingId}).\n`);
    return 0;
  }
  if (!confirmed) {
    out(`  would create company "${input.companyName}" (key ${input.key}) if missing\n`);
    out(`  would create SUPER_ADMIN ${input.email}\n`);
    out("Dry run only. Re-run with --yes to create them.\n");
    return 1;
  }
  const result = await seedSuperAdmin(db, input);
  if (!result.created) {
    out(`Nothing to do: a SUPER_ADMIN already exists (user id ${result.userId}).\n`);
    return 0;
  }
  out(`Created SUPER_ADMIN ${input.email} (user id ${result.userId}) `
    + `in company ${input.key} (id ${result.companyId}).\n`);
  return 0;
}

// Returns the process exit code. `db` is src/config/db (or a fake with the same API).
async function main(argv, { env, out, db }) {
  const options = parseArgs(argv);
  if (!options.urlEnv) {
    out(USAGE);
    return 1;
  }
  const url = env[options.urlEnv];
  if (!url) {
    throw new Error(`${options.urlEnv} is not set.`);
  }
  const input = readSeedInput(env);
  out(`Target: ${options.urlEnv}\n`);
  await db.configure({ url });
  try {
    return await run(db, input, { confirmed: options.confirmed, out });
  } finally {
    await db.closePool();
  }
}

if (require.main === module) {
  // eslint-disable-next-line n/global-require -- CLI only: load backend/.env before reading it
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  main(process.argv, {
    env: process.env,
    out: (text) => process.stdout.write(text),
    // eslint-disable-next-line n/global-require -- lazy, after .env is loaded
    db: require("../src/config/db"),
  }).then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`Seed failed: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs, readSeedInput, findSuperAdmin, seedSuperAdmin, main,
};
