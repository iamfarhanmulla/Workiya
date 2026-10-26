const {
  parseArgs, validArgs, maskSecrets, blockingProblems, sourceQuery, main,
} = require("./copy-sqlserver-to-postgres");
const { TABLES } = require("./lib/copyMappings");

const ENV = Object.freeze({
  DATABASE_URL_TEST: "postgresql://u:p@host/test",
  MSSQL_USER: "sqluser",
  MSSQL_PASSWORD: "sqlsecret",
});
const CREATED = new Date("2026-04-06T10:19:20.494Z");
const STORED_USER = Object.freeze({
  id: 19, company_id: 1, email: "a@x", role_id: 3, manager_id: null,
});

// Source rows per SQL Server table; every other table is empty.
const SOURCE = {
  Users: [
    {
      Id: 19, CompanyId: 1, Email: "a@x", RoleId: 3, ManagerId: null, CreatedAtUtc: CREATED,
    },
  ],
  Activities: [
    {
      Id: 1,
      CompanyId: 2,
      AccountId: 1,
      ActivityTypeId: 2,
      AssignedTo: 19,
      AssignedBy: 19,
      Status: "Pending",
      CreatedAtUtc: CREATED,
      ValidFromUtc: CREATED,
    },
  ],
};

function fakeSource(rows = SOURCE) {
  return {
    readRows: jest.fn(async (spec) => rows[spec.source] || []),
    close: jest.fn(async () => undefined),
  };
}

// Fake target client: empty tables, no missing tables, and SELECT-back rows from `stored`.
function fakeClient({
  stored = {}, filled = false, failOn, rollbackFails = false,
} = {}) {
  const texts = [];
  const query = jest.fn(async (text) => {
    texts.push(text);
    if (failOn && text.startsWith(failOn)) {
      throw new Error("boom");
    }
    if (rollbackFails && text === "ROLLBACK") {
      throw new Error("connection lost");
    }
    if (text.includes("EXISTS (SELECT 1")) {
      return { rows: [{ has_rows: filled }] };
    }
    const read = /^SELECT "id".* FROM "([a-z_]+)"$/.exec(text);
    return { rows: read ? stored[read[1]] || [] : [] };
  });
  return { query, texts };
}

async function run(args, { source = fakeSource(), client = fakeClient() } = {}) {
  const output = [];
  const close = jest.fn(async () => undefined);
  const openTarget = jest.fn(async () => ({ client, close }));
  const code = await main(["node", "copy.js", ...args], {
    env: ENV, out: (text) => output.push(text), openSource: async () => source, openTarget,
  });
  return {
    code, output: output.join(""), openTarget, close, source, client,
  };
}

describe("copy-sqlserver-to-postgres arguments", () => {
  it("parses flags and validates names", () => {
    // Arrange / Act
    const options = parseArgs(["node", "s", "--target-env", "DATABASE_URL_TEST", "--schema",
      "it_1_2", "--yes", "--reset"]);

    // Assert
    expect(options).toEqual({
      targetEnv: "DATABASE_URL_TEST",
      schema: "it_1_2",
      confirmed: true,
      reset: true,
    });
    expect(validArgs(options)).toBe(true);
    expect(validArgs({ targetEnv: "X", schema: "bad; DROP" })).toBe(false);
    expect(validArgs({ targetEnv: undefined })).toBe(false);
  });

  it("hides connection strings and SQL Server settings", () => {
    // Arrange
    const message = "failed for sqluser with sqlsecret at postgresql://u:p@h/db?x=1 now";

    // Act
    const masked = maskSecrets(message, { ...ENV, MSSQL_SERVER: "" });

    // Assert
    expect(masked).toBe("failed for <hidden> with <hidden> at <connection hidden> now");
  });

  it("builds read-only SELECTs that name hidden period columns", () => {
    // Arrange
    const history = TABLES.find((spec) => spec.source === "ActivitiesHistory");

    // Act
    const text = sourceQuery(history);

    // Assert
    expect(text).toMatch(/^SELECT \[Id\], \[CompanyId\], /);
    expect(text).toContain("[ValidFromUtc], [ValidToUtc] FROM [dbo].[ActivitiesHistory]");
    expect(text).toMatch(/ORDER BY \[Id\], \[ValidToUtc\]$/);
    expect(text).not.toContain("LegacyTaskId");
  });
});

describe("copy-sqlserver-to-postgres main", () => {
  it("prints usage for missing or invalid arguments", async () => {
    // Arrange / Act
    const result = await run(["--yes"]);

    // Assert
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/^Usage:/);
  });

  it("fails when the target variable is not set", async () => {
    // Arrange / Act
    const act = run(["--target-env", "MISSING_URL"]);

    // Assert
    await expect(act).rejects.toThrow("MISSING_URL is not set.");
  });

  it("dry run reads the source, lists skipped rows and writes nothing", async () => {
    // Arrange / Act
    const result = await run(["--target-env", "DATABASE_URL_TEST"]);

    // Assert
    expect(result.code).toBe(0);
    expect(result.source.close).toHaveBeenCalled();
    expect(result.openTarget).not.toHaveBeenCalled();
    expect(result.output).toContain("1 row(s) break the PostgreSQL same-company rules");
    expect(result.output).toContain("skipped: activities id 1: assigned_to user 19"
      + " belongs to company 1, not 2");
    expect(result.output).toContain("Dry run only: nothing was written.");
    expect(result.output).not.toContain("postgresql://");
  });

  it("dry run of clean data exits 0", async () => {
    // Arrange / Act
    const result = await run(["--target-env", "DATABASE_URL_TEST"], {
      source: fakeSource({ Users: SOURCE.Users }),
    });

    // Assert
    expect(result.code).toBe(0);
  });

  it("refuses to copy when a value cannot be converted", async () => {
    // Arrange
    const source = fakeSource({
      Accounts: [{
        Id: 3, CompanyId: 1, ExtraFields: "[1]", CreatedAtUtc: CREATED,
      }],
    });

    // Act
    const result = await run(["--target-env", "DATABASE_URL_TEST", "--yes"], { source });

    // Assert
    expect(result.code).toBe(1);
    expect(result.openTarget).not.toHaveBeenCalled();
    expect(result.output).toContain("conversion error: accounts id 3 extra_fields is not a JSON"
      + " object");
    expect(result.output).toContain("1 value(s) cannot be converted");
  });

  it("copies without the skipped rows, verifies and commits", async () => {
    // Arrange
    const client = fakeClient({ stored: { users: [STORED_USER] } });

    // Act
    const result = await run(
      ["--target-env", "DATABASE_URL_TEST", "--schema", "s1", "--yes"],
      { client },
    );

    // Assert
    expect(result.code).toBe(0);
    expect(result.openTarget).toHaveBeenCalledWith(ENV.DATABASE_URL_TEST, "s1");
    expect(client.texts[0]).toBe("BEGIN");
    expect(client.texts.at(-1)).toBe("COMMIT");
    expect(client.texts.filter((text) => text.startsWith("TRUNCATE"))).toEqual([]);
    expect(client.texts.some((text) => text.startsWith("INSERT INTO \"activities\""))).toBe(false);
    expect(result.output).toContain("skipped: activities id 1");
    expect(result.output).toMatch(/users\s+1\s+0\s+1\s+1\s+1\s+OK/);
    expect(result.output).toMatch(/activities\s+1\s+1\s+0\s+0\s+0\s+OK/);
    expect(result.output).toContain("Copy committed.");
    expect(result.close).toHaveBeenCalled();
  });

  it("rolls back and exits 1 when verification finds a mismatch", async () => {
    // Arrange
    const client = fakeClient({ stored: { users: [] } });

    // Act
    const result = await run(["--target-env", "DATABASE_URL_TEST", "--yes"], { client });

    // Assert
    expect(result.code).toBe(1);
    expect(client.texts.at(-1)).toBe("ROLLBACK");
    expect(client.texts).not.toContain("COMMIT");
    expect(result.output).toMatch(/users\s+1\s+0\s+1\s+0\s+0\s+MISMATCH/);
    expect(result.output).toContain("Verification failed: rolled back, nothing written.");
  });

  it("refuses a target that already holds rows unless --reset", async () => {
    // Arrange
    const client = fakeClient({ filled: true });

    // Act
    const act = run(["--target-env", "DATABASE_URL_TEST", "--yes"], { client });

    // Assert
    await expect(act).rejects.toThrow("Target tables already hold rows");
    expect(client.texts.at(-1)).toBe("ROLLBACK");
  });

  it("empties the target with triggers disabled when --reset is given", async () => {
    // Arrange
    const client = fakeClient({ filled: true, stored: { users: [STORED_USER] } });

    // Act
    const result = await run(
      ["--target-env", "DATABASE_URL_TEST", "--yes", "--reset"],
      { client },
    );

    // Assert
    const disable = client.texts.indexOf("ALTER TABLE \"audit_logs\" DISABLE TRIGGER USER");
    const truncate = client.texts.findIndex((text) => text.startsWith("TRUNCATE"));
    const enable = client.texts.indexOf("ALTER TABLE \"audit_logs\" ENABLE TRIGGER USER");
    expect(result.code).toBe(0);
    expect(disable).toBeGreaterThan(0);
    expect(truncate).toBeGreaterThan(disable);
    expect(enable).toBeGreaterThan(truncate);
    expect(result.output).toContain("Emptied 17 target tables (--reset).");
  });

  it("rolls back and rethrows when a write fails, even if ROLLBACK fails", async () => {
    // Arrange
    const client = fakeClient({ failOn: "INSERT INTO \"users\"", rollbackFails: true });

    // Act
    const act = run(["--target-env", "DATABASE_URL_TEST", "--yes"], { client });

    // Assert
    await expect(act).rejects.toThrow("boom");
    expect(client.texts.at(-1)).toBe("ROLLBACK");
  });

  it("blocks only on unconvertible values, never on skipped rows", () => {
    // Arrange
    const failing = [{ errors: [{ id: 1 }], rejected: [] }];
    const skipping = [{ errors: [], rejected: [{ id: 2 }] }];

    // Act
    const problems = blockingProblems(failing);

    // Assert
    expect(problems).toEqual(["1 value(s) cannot be converted; fix them in SQL Server first."]);
    expect(blockingProblems(skipping)).toEqual([]);
  });
});
