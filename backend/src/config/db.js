const pg = require("pg");
const config = require("./env");
const logger = require("../utils/logger");
const { compileNamed } = require("./namedParams");
const {
  SQLSTATE, isUniqueViolation, isForeignKeyViolation, isCheckViolation,
} = require("./dbErrors");

// NUMERIC (coordinates) and INT8 (bigint ids, COUNT(*)) arrive as JS numbers, not strings.
// Every value stored in them fits a double: numeric(10,7) and ids far below 2^53.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

const POOL_DEFAULTS = Object.freeze({
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

let pool = null;
let poolOptions = {};

// TLS is set here, not by the URL: sslmode and channel_binding are taken out of the URL so pg
// cannot weaken the explicit verify-full settings. sslmode=disable is honoured for a local or
// CI database without TLS.
function connectionConfig(url) {
  if (!url) {
    throw new Error("Database URL is not configured (set DATABASE_URL).");
  }
  const parsed = new URL(url);
  const sslDisabled = parsed.searchParams.get("sslmode") === "disable";
  const channelBinding = parsed.searchParams.get("channel_binding") === "require";
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("channel_binding");
  return {
    connectionString: parsed.toString(),
    ssl: sslDisabled ? false : { rejectUnauthorized: true },
    enableChannelBinding: channelBinding,
  };
}

function searchPathStatement(searchPath) {
  const schemas = (Array.isArray(searchPath) ? searchPath : String(searchPath).split(","))
    .map((schema) => schema.trim())
    .filter(Boolean);
  return `SET search_path TO ${schemas.map((schema) => pg.escapeIdentifier(schema)).join(", ")}`;
}

// A client class that sets search_path as part of connecting, so the pool hands out a
// connection only after the SET has finished. pg-pool calls connect(callback).
function clientWithSearchPath(searchPath) {
  const statement = searchPathStatement(searchPath);
  return class SearchPathClient extends pg.Client {
    connect(callback) {
      const ready = super.connect().then(() => super.query(statement)).then(() => undefined);
      if (!callback) {
        return ready;
      }
      ready.then(() => callback(), callback);
      return undefined;
    }
  };
}

// Builds a pool. The app uses getPool(); scripts that need another URL (e.g. the direct,
// non-pooled one for migrations) call this and end the pool themselves. searchPath (array or
// comma-separated string) is set on every connection; used by the integration tests.
function createPool({ url, searchPath, max } = {}) {
  const created = new pg.Pool({
    ...POOL_DEFAULTS,
    ...connectionConfig(url),
    max: max || POOL_DEFAULTS.max,
    ...(searchPath ? { Client: clientWithSearchPath(searchPath) } : {}),
  });
  created.on("error", (err) => logger.error({ err }, "Idle PostgreSQL client failed"));
  return created;
}

function getPool() {
  if (!pool) {
    pool = createPool({
      url: poolOptions.url || config.database.url,
      searchPath: poolOptions.searchPath,
    });
  }
  return pool;
}

async function closePool() {
  if (pool) {
    const closing = pool;
    pool = null;
    await closing.end();
  }
}

// Points the shared pool at another database or search_path (integration tests).
async function configure(options = {}) {
  await closePool();
  poolOptions = { ...options };
}

async function run(executor, text, params) {
  const compiled = compileNamed(text, params);
  const result = await executor.query(compiled.text, compiled.values);
  return { rows: result.rows, rowCount: result.rowCount };
}

function query(text, params = {}) {
  return run(getPool(), text, params);
}

// Returns the error that makes the connection unusable, so it is discarded, not reused.
async function rollbackQuietly(client) {
  try {
    await client.query("ROLLBACK");
    return undefined;
  } catch (rollbackErr) {
    logger.error({ err: rollbackErr }, "ROLLBACK failed; the connection is discarded");
    return rollbackErr;
  }
}

// Runs work(tx) inside BEGIN/COMMIT on one client; any error rolls back and is rethrown.
async function withTransaction(work) {
  const client = await getPool().connect();
  let brokenConnection;
  try {
    await client.query("BEGIN");
    const result = await work({ query: (text, params = {}) => run(client, text, params) });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    brokenConnection = await rollbackQuietly(client);
    throw err;
  } finally {
    client.release(brokenConnection);
  }
}

module.exports = {
  query,
  withTransaction,
  getPool,
  closePool,
  configure,
  createPool,
  connectionConfig,
  SQLSTATE,
  isUniqueViolation,
  isForeignKeyViolation,
  isCheckViolation,
};
