// One-time copy of Workiya's data from SQL Server (read-only) into PostgreSQL.
//   node scripts/copy-sqlserver-to-postgres.js --target-env <ENV_NAME> [--schema <name>]
//        [--yes] [--reset]
// Without --yes it is a dry run: it reads SQL Server and reports what would be copied.
// With --yes it writes the target in ONE transaction, keeps ids, resets identity sequences,
// verifies row counts and key columns per table, and rolls back on any mismatch.
// Rows that break the PostgreSQL same-company rules (with their dependent and history rows)
// are never copied; both reports list each of them with its table, id and reason.
// SQL Server is only read (SELECT, read-only intent). Values are never printed.
const path = require("node:path");
const { TABLES, RESET_TABLES } = require("./lib/copyMappings");
const { buildPlan } = require("./lib/copyRows");
const target = require("./lib/copyTarget");

const USAGE = "Usage: node scripts/copy-sqlserver-to-postgres.js --target-env <ENV_NAME>"
  + " [--schema <name>] [--yes] [--reset]\n";
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const SOURCE_SECRETS = ["MSSQL_SERVER", "MSSQL_DATABASE", "MSSQL_USER", "MSSQL_PASSWORD"];

function optionValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    targetEnv: optionValue(args, "--target-env"),
    schema: optionValue(args, "--schema"),
    confirmed: args.includes("--yes"),
    reset: args.includes("--reset"),
  };
}

function validArgs(options) {
  return Boolean(options.targetEnv) && NAME_PATTERN.test(options.targetEnv)
    && (options.schema === undefined || NAME_PATTERN.test(options.schema));
}

// Hides connection strings and SQL Server settings in error text.
function maskSecrets(message, env) {
  let masked = String(message).replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<connection hidden>");
  SOURCE_SECRETS.map((name) => env[name]).filter((value) => value && value.length >= 3)
    .forEach((value) => {
      masked = masked.split(value).join("<hidden>");
    });
  return masked;
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function printPlan(plan, out) {
  out(`${pad("table", 30)}${pad("source", 8)}${pad("skip", 6)}copy\n`);
  plan.forEach((entry) => {
    out(`${pad(entry.spec.target, 30)}${pad(entry.sourceCount, 8)}`
      + `${pad(entry.rejected.length, 6)}${entry.rows.length}\n`);
  });
  const skipped = plan.flatMap((entry) => entry.rejected
    .map((item) => `  skipped: ${entry.spec.target} id ${item.label}: ${item.reason}\n`));
  if (skipped.length > 0) {
    out(`${skipped.length} row(s) break the PostgreSQL same-company rules or depend on such`
      + " rows; they are not copied:\n");
    skipped.forEach((line) => out(line));
  }
  plan.forEach((entry) => {
    entry.errors.forEach((item) => {
      out(`  conversion error: ${entry.spec.target} id ${item.id} ${item.column} ${item.reason}\n`);
    });
  });
}

function printVerification(report, out) {
  out(`Verification (expected = source - skipped)\n${pad("table", 30)}${pad("source", 8)}`
    + `${pad("skip", 6)}${pad("expected", 10)}${pad("target", 8)}${pad("rows checked", 14)}`
    + "result\n");
  report.tables.forEach((item) => {
    out(`${pad(item.table, 30)}${pad(item.source, 8)}${pad(item.skipped, 6)}`
      + `${pad(item.expected, 10)}${pad(item.actual, 8)}${pad(item.checked, 14)}`
      + `${item.ok ? "OK" : "MISMATCH"}\n`);
    item.mismatches.forEach((mismatch) => {
      out(`  id ${mismatch.id}: ${mismatch.columns.join(", ")} differ\n`);
    });
  });
}

// Problems that stop a copy: values that cannot be converted. Skipped rows do not.
function blockingProblems(plan) {
  const errors = plan.reduce((sum, entry) => sum + entry.errors.length, 0);
  return errors > 0
    ? [`${errors} value(s) cannot be converted; fix them in SQL Server first.`]
    : [];
}

async function prepareTarget(client, { reset, out }) {
  await target.assertTablesExist(client, RESET_TABLES);
  const filled = await target.tablesWithRows(client, RESET_TABLES);
  if (filled.length > 0 && !reset) {
    throw new Error(`Target tables already hold rows (${filled.join(", ")}); `
      + "re-run with --reset to empty them first.");
  }
  await target.setUserTriggers(client, "DISABLE");
  if (filled.length > 0) {
    await target.truncateTargets(client);
    out(`Emptied ${RESET_TABLES.length} target tables (--reset).\n`);
  }
}

// Writes and verifies everything in one transaction. Returns the verification report;
// commits only when every table verifies.
async function copyInTransaction(client, plan, { reset, out }) {
  await client.query("BEGIN");
  try {
    await prepareTarget(client, { reset, out });
    // eslint-disable-next-line no-restricted-syntax -- tables are written in FK order
    for (const entry of plan) {
      // eslint-disable-next-line no-await-in-loop -- each table depends on earlier ones
      await target.insertRows(client, entry.spec, entry.rows);
      if (entry.spec.identity) {
        // eslint-disable-next-line no-await-in-loop -- see above
        await target.syncSequence(client, entry.spec);
      }
    }
    await target.setUserTriggers(client, "ENABLE");
    const report = await target.verifyPlan(client, plan);
    await client.query(report.ok ? "COMMIT" : "ROLLBACK");
    return report;
  } catch (err) {
    // A failed ROLLBACK must not hide the original error; the connection is closed anyway.
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  }
}

async function readPlan(openSource, env) {
  const source = await openSource(env);
  try {
    return await buildPlan(TABLES, (spec) => source.readRows(spec));
  } finally {
    await source.close();
  }
}

// Returns the process exit code. openSource(env) resolves { readRows(spec), close };
// openTarget(url, schema) resolves { client, close }.
async function main(argv, {
  env, out, openSource, openTarget,
}) {
  const options = parseArgs(argv);
  if (!validArgs(options)) {
    out(USAGE);
    return 1;
  }
  const url = env[options.targetEnv];
  if (!url) {
    throw new Error(`${options.targetEnv} is not set.`);
  }
  out(`Source: SQL Server (read-only) | target: ${options.targetEnv}`
    + `${options.schema ? `, schema ${options.schema}` : ""}`
    + ` | ${options.confirmed ? "copy" : "dry run"}\n`);
  const plan = await readPlan(openSource, env);
  printPlan(plan, out);
  const problems = blockingProblems(plan);
  problems.forEach((problem) => out(`${problem}\n`));
  if (!options.confirmed) {
    out("Dry run only: nothing was written. Re-run with --yes to copy.\n");
    return problems.length > 0 ? 1 : 0;
  }
  if (problems.length > 0) {
    return 1;
  }
  const { client, close } = await openTarget(url, options.schema);
  try {
    const report = await copyInTransaction(client, plan, { ...options, out });
    printVerification(report, out);
    out(report.ok ? "Copy committed.\n" : "Verification failed: rolled back, nothing written.\n");
    return report.ok ? 0 : 1;
  } finally {
    await close();
  }
}

function sourceQuery(spec) {
  const columns = spec.columns.map((column) => `[${column.source}]`).join(", ");
  const order = spec.orderBy.map((name) => spec.columns.find((c) => c.target === name).source);
  return `SELECT ${columns} FROM [dbo].[${spec.source}] ORDER BY ${
    order.map((name) => `[${name}]`).join(", ")}`;
}

// SQL Server, read-only: only SELECTs built from copyMappings.js, with read-only intent.
async function openSqlServer(env) {
  // eslint-disable-next-line n/global-require -- mssql is only needed by this one-time script
  const sql = require("mssql");
  const pool = await new sql.ConnectionPool({
    server: env.MSSQL_SERVER,
    database: env.MSSQL_DATABASE,
    user: env.MSSQL_USER,
    password: env.MSSQL_PASSWORD,
    options: {
      encrypt: true,
      trustServerCertificate: env.MSSQL_TRUST_SERVER_CERTIFICATE === "true",
      readOnlyIntent: true,
    },
  }).connect();
  return {
    readRows: async (spec) => (await pool.request().query(sourceQuery(spec))).recordset,
    close: () => pool.close(),
  };
}

async function openPostgres(url, schema) {
  // eslint-disable-next-line n/global-require -- lazy, so the module loads without a database
  const { createPool } = require("../src/config/db");
  const pool = createPool({ url, max: 1, ...(schema ? { searchPath: [schema, "public"] } : {}) });
  const client = await pool.connect();
  if (schema) {
    const { rows } = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [schema]);
    if (rows.length === 0) {
      client.release();
      await pool.end();
      throw new Error(`Schema ${schema} does not exist in the target database.`);
    }
  }
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
    openSource: openSqlServer,
    openTarget: openPostgres,
  }).then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`Copy failed: ${maskSecrets(err.message, process.env)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  validArgs,
  maskSecrets,
  blockingProblems,
  copyInTransaction,
  sourceQuery,
  openPostgres,
  main,
};
