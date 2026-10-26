// PostgreSQL side of the SQL Server -> PostgreSQL copy. Every function takes a pg client that
// is already inside the copy transaction. Table and column names come from copyMappings.js
// (code-defined); every value is sent as a $n parameter.
const { escapeIdentifier } = require("pg");
const { TRIGGER_TABLES, RESET_TABLES } = require("./copyMappings");
const { compareTable, isTableVerified } = require("./copyRows");

// Rows per INSERT statement: keeps the parameter count far below PostgreSQL's 65535.
const BATCH_SIZE = 500;

const quote = (name) => escapeIdentifier(name);

// Fails when a target table is missing (migrations not applied to this database/schema).
async function assertTablesExist(client, tableNames) {
  const { rows } = await client.query(
    "SELECT name FROM unnest($1::text[]) AS name WHERE to_regclass(name) IS NULL",
    [tableNames],
  );
  if (rows.length > 0) {
    throw new Error(`Target tables missing (apply the migrations first): ${
      rows.map((row) => row.name).join(", ")}.`);
  }
}

// Target tables that already hold rows.
async function tablesWithRows(client, tableNames) {
  const filled = [];
  // eslint-disable-next-line no-restricted-syntax -- one statement at a time on one client
  for (const name of tableNames) {
    // eslint-disable-next-line no-await-in-loop -- sequential on the transaction's client
    const { rows } = await client.query(
      `SELECT EXISTS (SELECT 1 FROM ${quote(name)}) AS has_rows`,
    );
    if (rows[0].has_rows) {
      filled.push(name);
    }
  }
  return filled;
}

// Empties every copied table (and refresh_tokens). The audit_logs TRUNCATE trigger must be
// disabled first (setUserTriggers); the transaction restores everything if the copy fails.
async function truncateTargets(client) {
  await client.query(`TRUNCATE ${RESET_TABLES.map(quote).join(", ")} RESTART IDENTITY CASCADE`);
}

// "DISABLE" or "ENABLE" the history, valid_from and audit triggers (not FK triggers).
async function setUserTriggers(client, action) {
  const verb = action === "ENABLE" ? "ENABLE" : "DISABLE";
  // eslint-disable-next-line no-restricted-syntax -- one ALTER at a time on one client
  for (const name of TRIGGER_TABLES) {
    // eslint-disable-next-line no-await-in-loop -- sequential on the transaction's client
    await client.query(`ALTER TABLE ${quote(name)} ${verb} TRIGGER USER`);
  }
}

function insertStatement(spec, batch) {
  const values = [];
  const tuples = batch.map((row) => {
    const placeholders = spec.columns.map((column) => {
      const value = spec.deferred.includes(column.target) ? null : row[column.target] ?? null;
      values.push(value);
      return column.jsonb ? `$${values.length}::jsonb` : `$${values.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  const columns = spec.columns.map((column) => quote(column.target)).join(", ");
  const overriding = spec.identity ? " OVERRIDING SYSTEM VALUE" : "";
  return {
    text: `INSERT INTO ${quote(spec.target)} (${columns})${overriding} VALUES ${tuples.join(", ")}`,
    values,
  };
}

// Writes deferred columns (users.manager_id) once every row of the table exists.
async function writeDeferred(client, spec, rows) {
  // eslint-disable-next-line no-restricted-syntax -- one UPDATE at a time on one client
  for (const column of spec.deferred) {
    const pending = rows.filter((row) => row[column] !== null);
    // eslint-disable-next-line no-restricted-syntax -- see above
    for (const row of pending) {
      // eslint-disable-next-line no-await-in-loop -- sequential on the transaction's client
      await client.query(
        `UPDATE ${quote(spec.target)} SET ${quote(column)} = $1 WHERE id = $2`,
        [row[column], row.id],
      );
    }
  }
}

async function insertRows(client, spec, rows) {
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const statement = insertStatement(spec, rows.slice(start, start + BATCH_SIZE));
    // eslint-disable-next-line no-await-in-loop -- batches go one after another
    await client.query(statement.text, statement.values);
  }
  await writeDeferred(client, spec, rows);
}

// Moves each identity sequence past the highest copied id.
async function syncSequence(client, spec) {
  await client.query(
    "SELECT setval(pg_get_serial_sequence($1, 'id'), m.max_id)"
    + ` FROM (SELECT max(id) AS max_id FROM ${quote(spec.target)}) AS m`
    + " WHERE m.max_id IS NOT NULL",
    [spec.target],
  );
}

async function readTargetRows(client, spec) {
  const columns = [...new Set(["id", ...spec.orderBy, ...spec.verify])];
  const { rows } = await client.query(
    `SELECT ${columns.map(quote).join(", ")} FROM ${quote(spec.target)}`,
  );
  return rows;
}

// Verifies every table: row count (source minus skipped rows) and id + key columns of every
// copied row.
async function verifyPlan(client, plan) {
  const tables = [];
  // eslint-disable-next-line no-restricted-syntax -- one SELECT at a time on one client
  for (const entry of plan) {
    // eslint-disable-next-line no-await-in-loop -- sequential on the transaction's client
    const result = compareTable(entry, await readTargetRows(client, entry.spec));
    tables.push({
      table: entry.spec.target,
      source: entry.sourceCount,
      skipped: entry.rejected.length,
      ...result,
      ok: isTableVerified(result),
    });
  }
  return { ok: tables.every((item) => item.ok), tables };
}

module.exports = {
  BATCH_SIZE,
  assertTablesExist,
  tablesWithRows,
  truncateTargets,
  setUserTriggers,
  insertStatement,
  insertRows,
  syncSequence,
  readTargetRows,
  verifyPlan,
};
