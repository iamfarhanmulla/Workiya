const path = require("node:path");
const dotenv = require("dotenv");
const { escapeIdentifier } = require("pg");
const { resolveTestUrl, SCHEMA_PATTERN } = require("./helpers/testDb");

const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

// Drops schemas left behind by integration runs that crashed more than 6 hours ago.
async function dropStaleSchemas(client) {
  const { rows } = await client.query(
    "SELECT nspname FROM pg_namespace WHERE nspname ~ '^it_[0-9]+_[0-9]+$'",
  );
  const stale = rows.map((row) => row.nspname).filter((name) => SCHEMA_PATTERN.test(name)
    && Date.now() - Number(name.split("_")[1]) > STALE_AFTER_MS);
  // eslint-disable-next-line no-restricted-syntax -- one DROP at a time on one connection
  for (const name of stale) {
    // eslint-disable-next-line no-await-in-loop -- sequential on purpose
    await client.query(`DROP SCHEMA IF EXISTS ${escapeIdentifier(name)} CASCADE`);
  }
}

// Creates a unique schema in the DATABASE_URL_TEST database and applies every migration into
// it. Tests reach it through helpers/testDb.useTestDb(); globalTeardown drops it.
module.exports = async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env"), quiet: true });
  // Loaded after dotenv so config/env sees the same environment.
  // eslint-disable-next-line n/global-require -- see above
  const { createPool } = require("../../src/config/db");
  // eslint-disable-next-line n/global-require -- see above
  const { migrateUp } = require("../../scripts/run-pg-migration");
  const schema = `it_${Date.now()}_${process.pid}`;
  const pool = createPool({ url: resolveTestUrl(), searchPath: [schema, "public"], max: 1 });
  const client = await pool.connect();
  try {
    await dropStaleSchemas(client);
    await client.query(`CREATE SCHEMA ${escapeIdentifier(schema)}`);
    await migrateUp(client);
    process.env.TEST_SCHEMA = schema;
  } catch (err) {
    await client.query(`DROP SCHEMA IF EXISTS ${escapeIdentifier(schema)} CASCADE`);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};
