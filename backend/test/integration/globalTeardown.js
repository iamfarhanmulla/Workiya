const { escapeIdentifier } = require("pg");
const { resolveTestUrl, testSchema } = require("./helpers/testDb");

// Drops the run's schema (and everything in it) created by globalSetup.
module.exports = async function globalTeardown() {
  if (!process.env.TEST_SCHEMA) {
    return;
  }
  // eslint-disable-next-line n/global-require -- loaded only when there is a schema to drop
  const { createPool } = require("../../src/config/db");
  const pool = createPool({ url: resolveTestUrl(), max: 1 });
  try {
    await pool.query(`DROP SCHEMA IF EXISTS ${escapeIdentifier(testSchema())} CASCADE`);
  } finally {
    await pool.end();
  }
};
