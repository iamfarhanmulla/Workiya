const fs = require("node:fs");
const path = require("node:path");
const { parseArgs, extractSection, splitBatches } = require("./run-sql-migration");

const MIGRATION = path.resolve(
  __dirname,
  "..",
  "db",
  "migrations",
  "20261016120000_WI-TBD_create_refresh_tokens_and_audit_logs.sql",
);

describe("run-sql-migration helpers", () => {
  it("parses file, direction and the --yes flag", () => {
    // Arrange / Act
    const parsed = parseArgs(["node", "script", "x.sql", "down", "--yes"]);
    const defaults = parseArgs(["node", "script", "x.sql"]);

    // Assert
    expect(parsed).toEqual({ file: "x.sql", direction: "down", confirmed: true });
    expect(defaults).toEqual({ file: "x.sql", direction: "up", confirmed: false });
  });

  it("extracts only the requested section and splits on GO lines", () => {
    // Arrange
    const content = [
      "-- header", "-- ==== UP ====", "SELECT 1;", "GO", "", "SELECT 2;", "go",
      "-- ==== DOWN ====", "SELECT 3;", "GO",
    ].join("\n");

    // Act
    const up = splitBatches(extractSection(content, "up"));
    const down = splitBatches(extractSection(content, "down"));

    // Assert
    expect(up.map((b) => b.trim())).toEqual(["SELECT 1;", "SELECT 2;"]);
    expect(down.map((b) => b.trim())).toEqual(["SELECT 3;"]);
  });

  it("throws when a section marker is missing", () => {
    // Arrange / Act / Assert
    expect(() => extractSection("SELECT 1;", "up")).toThrow(/not found/);
  });

  it("parses the real migration file into UP and DOWN batches", () => {
    // Arrange
    // eslint-disable-next-line n/no-sync -- test reads a fixture file
    const content = fs.readFileSync(MIGRATION, "utf8");

    // Act
    const up = splitBatches(extractSection(content, "up"));
    const down = splitBatches(extractSection(content, "down"));

    // Assert
    expect(up.length).toBeGreaterThanOrEqual(7);
    const trigger = "CREATE OR ALTER TRIGGER dbo.trg_AuditLogs_Immutable";
    expect(up.some((b) => b.includes(trigger))).toBe(true);
    expect(up.every((b) => !b.includes("DROP TABLE"))).toBe(true);
    expect(down).toHaveLength(4);
  });

  it("lets RefreshTokens.CompanyId be NULL for users without a company", () => {
    // Arrange
    // eslint-disable-next-line n/no-sync -- test reads a fixture file
    const content = fs.readFileSync(MIGRATION, "utf8");

    // Act
    const up = splitBatches(extractSection(content, "up")).join("\n");

    // Assert
    expect(up).toMatch(/CompanyId\s+INT\s+NULL,/);
    expect(up).not.toMatch(/CompanyId\s+INT\s+NOT NULL/);
    expect(up).toContain("ALTER TABLE dbo.RefreshTokens ALTER COLUMN CompanyId INT NULL");
    expect(up).toContain("FOREIGN KEY (CompanyId) REFERENCES dbo.Companies (Id)");
  });

  it.each(["FailedLoginCount", "LockoutEndUtc", "LastFailedLoginUtc", "LastLoginUtc", "UpdatedBy"])(
    "adds the Users.%s column the auth code reads, only when it is missing",
    (column) => {
      // Arrange
      // eslint-disable-next-line n/no-sync -- test reads a fixture file
      const content = fs.readFileSync(MIGRATION, "utf8");

      // Act
      const up = splitBatches(extractSection(content, "up")).join("\n");

      // Assert
      expect(up).toContain(`IF COL_LENGTH('dbo.Users', '${column}') IS NULL`);
      expect(up).toContain(`@level2name = N'${column}'`);
    },
  );
});
