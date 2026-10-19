const fs = require("fs");
const path = require("path");

const SECTION_MARKERS = Object.freeze({
  up: "-- ==== UP ====",
  down: "-- ==== DOWN ===="
});

function parseArgs(argv) {
  const args = argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--") && arg !== "up" && arg !== "down");
  const direction = args.includes("down") ? "down" : "up";
  return { file, direction, confirmed: args.includes("--yes") };
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
  return lines.slice(start + 1, end);
}

function splitBatches(lines) {
  const batches = [];
  let current = [];
  lines.forEach((line) => {
    if (/^GO$/i.test(line.trim())) {
      batches.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  });
  batches.push(current.join("\n"));
  return batches.filter((batch) => batch.replace(/--.*$/gm, "").trim().length > 0);
}

async function recordMigration(transaction, sql, fileName, direction) {
  const request = new sql.Request(transaction).input("fileName", sql.NVarChar(255), fileName);
  if (direction === "up") {
    await request.query(`
      IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM SchemaMigrations WHERE FileName = @fileName)
        INSERT INTO SchemaMigrations (FileName) VALUES (@fileName);
    `);
    return;
  }
  await request.query(`
    IF OBJECT_ID('dbo.SchemaMigrations', 'U') IS NOT NULL
      DELETE FROM SchemaMigrations WHERE FileName = @fileName;
  `);
}

async function runBatches(batches, fileName, direction) {
  const { connectDb, sql } = require("../src/config/db");
  const pool = await connectDb();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    for (const batch of batches) {
      await new sql.Request(transaction).batch(batch);
    }
    await recordMigration(transaction, sql, fileName, direction);
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  } finally {
    await pool.close();
  }
}

async function main() {
  const { file, direction, confirmed } = parseArgs(process.argv);
  if (!file) {
    process.stderr.write("Usage: npm run db:sql -- <file.sql> [up|down] --yes\n");
    process.exitCode = 1;
    return;
  }
  const filePath = path.resolve(process.cwd(), file);
  const batches = splitBatches(extractSection(fs.readFileSync(filePath, "utf8"), direction));
  process.stdout.write(`${path.basename(filePath)} [${direction}]: ${batches.length} batch(es)\n`);
  if (!confirmed) {
    process.stderr.write("Dry run only. Re-run with --yes to apply these batches to the configured database.\n");
    process.exitCode = 1;
    return;
  }
  await runBatches(batches, path.basename(filePath), direction);
  process.stdout.write("Migration applied.\n");
}

if (require.main === module) {
  main().catch((err) => {
    process.stderr.write(`Migration failed: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { parseArgs, extractSection, splitBatches };
