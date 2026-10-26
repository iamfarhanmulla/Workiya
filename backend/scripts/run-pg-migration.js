const fs = require("node:fs");
const path = require("node:path");

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "db", "postgres");
const FILE_PATTERN = /^\d{14}_[A-Za-z0-9-]+_[A-Za-z0-9_-]+\.sql$/;
const DEFAULT_URL_ENV = "DATABASE_URL_DIRECT";
const SECTION_MARKERS = Object.freeze({
  up: "-- ==== UP ====",
  down: "-- ==== DOWN ====",
});
const USAGE = "Usage: node scripts/run-pg-migration.js status | up [--yes] | down <file> [--yes]"
  + " [--url-env <ENV_NAME>]\n";

function parseArgs(argv) {
  const args = argv.slice(2);
  const urlEnvIndex = args.indexOf("--url-env");
  const urlEnv = urlEnvIndex === -1 ? DEFAULT_URL_ENV : args[urlEnvIndex + 1];
  const positional = args.filter((arg, i) => !arg.startsWith("--")
    && (urlEnvIndex === -1 || i !== urlEnvIndex + 1));
  return {
    command: positional[0],
    file: positional[1] ? path.basename(positional[1]) : undefined,
    confirmed: args.includes("--yes"),
    urlEnv,
  };
}

function extractSection(content, direction) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === SECTION_MARKERS[direction]);
  if (start === -1) {
    throw new Error(`Section "${SECTION_MARKERS[direction]}" not found.`);
  }
  const otherMarker = direction === "up" ? SECTION_MARKERS.down : SECTION_MARKERS.up;
  const relativeEnd = lines.slice(start + 1).findIndex((line) => line.trim() === otherMarker);
  const end = relativeEnd === -1 ? lines.length : start + 1 + relativeEnd;
  const sql = lines.slice(start + 1, end).join("\n");
  if (sql.replace(/--.*$/gm, "").trim().length === 0) {
    throw new Error(`Section "${SECTION_MARKERS[direction]}" is empty.`);
  }
  return sql;
}

function listMigrationFiles(dir = MIGRATIONS_DIR) {
  // eslint-disable-next-line n/no-sync -- one-shot CLI / test setup, sync I/O is intended
  return fs.readdirSync(dir).filter((name) => FILE_PATTERN.test(name)).sort();
}

function readSection(dir, fileName, direction) {
  // eslint-disable-next-line n/no-sync -- one-shot CLI / test setup, sync I/O is intended
  return extractSection(fs.readFileSync(path.join(dir, fileName), "utf8"), direction);
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file_name  varchar(255) PRIMARY KEY,
      applied_at timestamptz  NOT NULL DEFAULT now()
    )`);
}

// Applied file names; an empty list when schema_migrations does not exist yet (read-only).
async function appliedFiles(client) {
  const exists = await client.query("SELECT to_regclass('schema_migrations') IS NOT NULL AS ok");
  if (!exists.rows[0].ok) {
    return [];
  }
  const result = await client.query("SELECT file_name FROM schema_migrations ORDER BY file_name");
  return result.rows.map((row) => row.file_name);
}

// Runs one section and its schema_migrations bookkeeping in a single transaction.
async function applyFile(client, { dir, fileName, direction }) {
  const sql = readSection(dir, fileName, direction);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    if (direction === "up") {
      await client.query("INSERT INTO schema_migrations (file_name) VALUES ($1)", [fileName]);
    } else {
      await client.query("DELETE FROM schema_migrations WHERE file_name = $1", [fileName]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function pendingFiles(client, dir) {
  const applied = new Set(await appliedFiles(client));
  return listMigrationFiles(dir).filter((name) => !applied.has(name));
}

// Applies every pending migration in file-name order. Returns the applied file names.
async function migrateUp(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  await ensureMigrationsTable(client);
  const pending = await pendingFiles(client, dir);
  // eslint-disable-next-line no-restricted-syntax -- migrations must run one after another
  for (const fileName of pending) {
    // eslint-disable-next-line no-await-in-loop -- each migration depends on the previous one
    await applyFile(client, { dir, fileName, direction: "up" });
    log(`  applied ${fileName}\n`);
  }
  return pending;
}

async function runStatus(client, { dir, out }) {
  const applied = new Set(await appliedFiles(client));
  listMigrationFiles(dir).forEach((name) => {
    out(`  ${applied.has(name) ? "applied" : "pending"}  ${name}\n`);
  });
  return 0;
}

async function runUp(client, { dir, out, confirmed }) {
  const pending = await pendingFiles(client, dir);
  if (pending.length === 0) {
    out("Nothing to apply: every migration is applied.\n");
    return 0;
  }
  if (!confirmed) {
    pending.forEach((name) => out(`  would apply ${name}\n`));
    out("Dry run only. Re-run with --yes to apply these migrations.\n");
    return 1;
  }
  const done = await migrateUp(client, { dir, log: out });
  out(`Applied ${done.length} migration(s).\n`);
  return 0;
}

// Reverts one migration, and only the most recently applied one, so dependants never break.
async function runDown(client, {
  dir, out, confirmed, file,
}) {
  if (!file) {
    throw new Error("down needs the migration file name.");
  }
  const applied = await appliedFiles(client);
  if (!applied.includes(file)) {
    throw new Error(`${file} is not applied.`);
  }
  if (applied[applied.length - 1] !== file) {
    throw new Error(`${file} is not the latest applied migration; revert later ones first.`);
  }
  readSection(dir, file, "down");
  if (!confirmed) {
    out(`  would revert ${file}\nDry run only. Re-run with --yes to revert it.\n`);
    return 1;
  }
  await applyFile(client, { dir, fileName: file, direction: "down" });
  out(`Reverted ${file}.\n`);
  return 0;
}

const COMMANDS = Object.freeze({ status: runStatus, up: runUp, down: runDown });

// Returns the process exit code. `connect(url)` resolves { client, close }.
async function main(argv, {
  env, out, connect, dir = MIGRATIONS_DIR,
}) {
  const options = parseArgs(argv);
  const command = COMMANDS[options.command];
  if (!command || !options.urlEnv) {
    out(USAGE);
    return 1;
  }
  const url = env[options.urlEnv];
  if (!url) {
    throw new Error(`${options.urlEnv} is not set.`);
  }
  out(`Target: ${options.urlEnv} | command: ${options.command}\n`);
  const { client, close } = await connect(url);
  try {
    return await command(client, { ...options, dir, out });
  } finally {
    await close();
  }
}

async function connectWithPool(url) {
  // eslint-disable-next-line n/global-require -- lazy, so the module loads without a database
  const { createPool } = require("../src/config/db");
  const pool = createPool({ url, max: 1 });
  const client = await pool.connect();
  return {
    client,
    close: async () => {
      client.release();
      await pool.end();
    },
  };
}

if (require.main === module) {
  // eslint-disable-next-line n/global-require -- CLI only: load backend/.env before reading it
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  main(process.argv, {
    env: process.env,
    out: (text) => process.stdout.write(text),
    connect: connectWithPool,
  }).then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`Migration failed: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  extractSection,
  listMigrationFiles,
  appliedFiles,
  migrateUp,
  main,
  MIGRATIONS_DIR,
};
