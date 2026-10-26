const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  parseArgs, extractSection, listMigrationFiles, main, MIGRATIONS_DIR,
} = require("./run-pg-migration");

const FIRST = "20260101000000_WI-TBD_first.sql";
const SECOND = "20260101000100_WI-TBD_second.sql";
const ENV = Object.freeze({ DATABASE_URL_DIRECT: "postgresql://direct", OTHER_URL: "x" });

let dir;

function migrationText(name) {
  return `-- ${name}\n-- ==== UP ====\nCREATE TABLE ${name} (id int);\n`
    + `-- ==== DOWN ====\nDROP TABLE ${name};\n`;
}

// Fake pg client. `applied` null means schema_migrations does not exist yet.
function fakeClient({ applied = null, failOn } = {}) {
  const statements = [];
  const query = jest.fn(async (text) => {
    statements.push(text.trim());
    if (failOn && text.includes(failOn)) {
      throw new Error("boom");
    }
    if (text.includes("to_regclass")) {
      return { rows: [{ ok: applied !== null }] };
    }
    if (text.startsWith("SELECT file_name")) {
      return { rows: (applied || []).map((name) => ({ file_name: name })) };
    }
    return { rows: [], rowCount: 0 };
  });
  return { query, statements };
}

async function runMain(args, client, env = ENV) {
  const output = [];
  const close = jest.fn();
  const connect = jest.fn(async () => ({ client, close }));
  const code = await main(["node", "run-pg-migration.js", ...args], {
    env, out: (text) => output.push(text), connect, dir,
  });
  return {
    code, output: output.join(""), close, connect,
  };
}

beforeAll(() => {
  // eslint-disable-next-line n/no-sync -- test fixture setup
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pg-migrations-"));
  // eslint-disable-next-line n/no-sync -- test fixture setup
  fs.writeFileSync(path.join(dir, SECOND), migrationText("second"));
  // eslint-disable-next-line n/no-sync -- test fixture setup
  fs.writeFileSync(path.join(dir, FIRST), migrationText("first"));
  // eslint-disable-next-line n/no-sync -- test fixture setup
  fs.writeFileSync(path.join(dir, "README.txt"), "not a migration");
});

afterAll(() => {
  // eslint-disable-next-line n/no-sync -- test fixture cleanup
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("run-pg-migration parsing", () => {
  it("parses the command, file, confirmation and URL variable", () => {
    // Arrange / Act
    const defaults = parseArgs(["node", "s", "up"]);
    const down = parseArgs(["node", "s", "down", "db/postgres/x.sql", "--yes", "--url-env", "T"]);

    // Assert
    expect(defaults).toEqual({
      command: "up", file: undefined, confirmed: false, urlEnv: "DATABASE_URL_DIRECT",
    });
    expect(down).toEqual({
      command: "down", file: "x.sql", confirmed: true, urlEnv: "T",
    });
  });

  it("extracts the UP and DOWN sections and rejects missing or empty ones", () => {
    // Arrange
    const text = migrationText("t");

    // Act
    const up = extractSection(text, "up");
    const down = extractSection(text, "down");

    // Assert
    expect(up.trim()).toBe("CREATE TABLE t (id int);");
    expect(down.trim()).toBe("DROP TABLE t;");
    expect(() => extractSection("SELECT 1;", "up")).toThrow(/not found/);
    expect(() => extractSection("-- ==== UP ====\n-- only a comment\n", "up")).toThrow(/empty/);
  });

  it("lists only migration files, in order, and finds the real PostgreSQL migrations", () => {
    // Arrange / Act
    const listed = listMigrationFiles(dir);
    const real = listMigrationFiles(MIGRATIONS_DIR);

    // Assert
    expect(listed).toEqual([FIRST, SECOND]);
    expect(real.length).toBeGreaterThanOrEqual(3);
    expect(real.every((name) => name.endsWith(".sql"))).toBe(true);
  });
});

describe("run-pg-migration commands", () => {
  it("prints usage for an unknown command and needs the URL variable to be set", async () => {
    // Arrange
    const client = fakeClient();

    // Act
    const usage = await runMain(["drop-everything"], client);
    const missing = runMain(["status", "--url-env", "NOT_SET"], client);

    // Assert
    expect(usage.code).toBe(1);
    expect(usage.output).toMatch(/Usage/);
    await expect(missing).rejects.toThrow("NOT_SET is not set.");
  });

  it("reports applied and pending migrations without printing the URL", async () => {
    // Arrange
    const client = fakeClient({ applied: [FIRST] });

    // Act
    const result = await runMain(["status", "--url-env", "OTHER_URL"], client);

    // Assert
    expect(result.code).toBe(0);
    expect(result.output).toContain(`applied  ${FIRST}`);
    expect(result.output).toContain(`pending  ${SECOND}`);
    expect(result.output).toContain("Target: OTHER_URL");
    expect(result.output).not.toContain("postgresql://");
    expect(result.connect).toHaveBeenCalledWith("x");
    expect(result.close).toHaveBeenCalled();
  });

  it("only lists pending migrations on a dry run", async () => {
    // Arrange
    const client = fakeClient();

    // Act
    const result = await runMain(["up"], client);

    // Assert
    expect(result.code).toBe(1);
    expect(result.output).toContain(`would apply ${FIRST}`);
    expect(client.statements).not.toContain("BEGIN");
  });

  it("applies each pending migration in its own transaction", async () => {
    // Arrange
    const client = fakeClient({ applied: [FIRST] });

    // Act
    const result = await runMain(["up", "--yes"], client);

    // Assert
    expect(result.code).toBe(0);
    expect(client.statements.slice(-4)).toEqual([
      "BEGIN",
      "CREATE TABLE second (id int);",
      "INSERT INTO schema_migrations (file_name) VALUES ($1)",
      "COMMIT",
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.any(String), [SECOND]);
    expect(result.output).toContain("Applied 1 migration(s).");
  });

  it("has nothing to do when every migration is applied", async () => {
    // Arrange
    const client = fakeClient({ applied: [FIRST, SECOND] });

    // Act
    const result = await runMain(["up", "--yes"], client);

    // Assert
    expect(result.code).toBe(0);
    expect(result.output).toContain("Nothing to apply");
  });

  it("rolls back a failing migration and closes the connection", async () => {
    // Arrange
    const client = fakeClient({ applied: [], failOn: "CREATE TABLE first" });

    // Act
    const run = runMain(["up", "--yes"], client);

    // Assert
    await expect(run).rejects.toThrow("boom");
    expect(client.statements.slice(-2)).toEqual(["CREATE TABLE first (id int);", "ROLLBACK"]);
  });
});

describe("run-pg-migration down", () => {
  it("refuses a missing, unapplied or not-latest migration", async () => {
    // Arrange
    const client = fakeClient({ applied: [FIRST, SECOND] });
    const partly = fakeClient({ applied: [FIRST] });

    // Act
    const noFile = runMain(["down"], client);
    const notApplied = runMain(["down", SECOND], partly);
    const notLatest = runMain(["down", FIRST], client);

    // Assert
    await expect(noFile).rejects.toThrow(/needs the migration file/);
    await expect(notApplied).rejects.toThrow(/is not applied/);
    await expect(notLatest).rejects.toThrow(/not the latest/);
  });

  it("dry-runs and then reverts the latest migration", async () => {
    // Arrange
    const dryClient = fakeClient({ applied: [FIRST, SECOND] });
    const client = fakeClient({ applied: [FIRST, SECOND] });

    // Act
    const dry = await runMain(["down", SECOND], dryClient);
    const real = await runMain(["down", SECOND, "--yes"], client);

    // Assert
    expect(dry.code).toBe(1);
    expect(dryClient.statements).not.toContain("BEGIN");
    expect(real.code).toBe(0);
    expect(client.statements.slice(-4)).toEqual([
      "BEGIN",
      "DROP TABLE second;",
      "DELETE FROM schema_migrations WHERE file_name = $1",
      "COMMIT",
    ]);
  });
});
