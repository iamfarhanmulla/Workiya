const { TABLES, TRIGGER_TABLES, RESET_TABLES } = require("./copyMappings");
const target = require("./copyTarget");

const spec = (name) => TABLES.find((item) => item.target === name);

// Fake pg client: records statements; `respond(text, values)` may return { rows }.
function fakeClient(respond = () => undefined) {
  const calls = [];
  const query = jest.fn(async (text, values) => {
    calls.push({ text, values });
    return respond(text, values) || { rows: [], rowCount: 0 };
  });
  return { query, calls };
}

describe("copyTarget checks", () => {
  it("fails when target tables are missing", async () => {
    // Arrange
    const client = fakeClient(() => ({ rows: [{ name: "users" }, { name: "roles" }] }));

    // Act
    const act = target.assertTablesExist(client, ["users", "roles", "genders"]);

    // Assert
    await expect(act).rejects.toThrow("Target tables missing (apply the migrations first):"
      + " users, roles.");
    expect(client.calls[0].values).toEqual([["users", "roles", "genders"]]);
  });

  it("passes when every table exists", async () => {
    // Arrange
    const client = fakeClient();

    // Act / Assert
    await expect(target.assertTablesExist(client, ["users"])).resolves.toBeUndefined();
  });

  it("lists tables that already hold rows", async () => {
    // Arrange
    const client = fakeClient((text) => ({ rows: [{ has_rows: text.includes("\"users\"") }] }));

    // Act
    const filled = await target.tablesWithRows(client, ["genders", "users"]);

    // Assert
    expect(filled).toEqual(["users"]);
  });
});

describe("copyTarget writes", () => {
  it("truncates every reset table in one statement", async () => {
    // Arrange
    const client = fakeClient();

    // Act
    await target.truncateTargets(client);

    // Assert
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].text).toMatch(/^TRUNCATE "submissions_history", .*"refresh_tokens"/);
    expect(client.calls[0].text).toMatch(/RESTART IDENTITY CASCADE$/);
    expect(client.calls[0].text.split(",")).toHaveLength(RESET_TABLES.length);
  });

  it("disables and enables user triggers on the trigger tables", async () => {
    // Arrange
    const client = fakeClient();

    // Act
    await target.setUserTriggers(client, "DISABLE");
    await target.setUserTriggers(client, "ENABLE");

    // Assert
    const texts = client.calls.map((call) => call.text);
    expect(texts).toHaveLength(TRIGGER_TABLES.length * 2);
    expect(texts[0]).toBe("ALTER TABLE \"audit_logs\" DISABLE TRIGGER USER");
    expect(texts[TRIGGER_TABLES.length]).toBe("ALTER TABLE \"audit_logs\" ENABLE TRIGGER USER");
  });

  it("builds a parameterised INSERT with jsonb casts and kept ids", () => {
    // Arrange
    const rows = [{ id: 5, event_type: "X", new_value: "{\"a\":1}" }];

    // Act
    const statement = target.insertStatement(spec("audit_logs"), rows);

    // Assert
    expect(statement.text).toMatch(/^INSERT INTO "audit_logs" \("id", "event_type", /);
    expect(statement.text).toContain("OVERRIDING SYSTEM VALUE VALUES ($1, $2, ");
    expect(statement.text).toContain("$9::jsonb");
    expect(statement.values[0]).toBe(5);
    expect(statement.values[8]).toBe("{\"a\":1}");
    expect(statement.values).toHaveLength(spec("audit_logs").columns.length);
  });

  it("omits OVERRIDING SYSTEM VALUE for history tables", () => {
    // Arrange / Act
    const statement = target.insertStatement(spec("activities_history"), [{ id: 1 }]);

    // Assert
    expect(statement.text).not.toContain("OVERRIDING");
    expect(statement.values[0]).toBe(1);
    expect(statement.values.slice(1).every((value) => value === null)).toBe(true);
  });

  it("inserts users with manager_id NULL first, then sets manager_id", async () => {
    // Arrange
    const client = fakeClient();
    const rows = [{ id: 10, manager_id: null }, { id: 19, manager_id: 10 }];
    const managerIndex = spec("users").columns.findIndex((c) => c.target === "manager_id");

    // Act
    await target.insertRows(client, spec("users"), rows);

    // Assert
    expect(client.calls).toHaveLength(2);
    expect(client.calls[0].values[managerIndex]).toBeNull();
    expect(client.calls[1]).toEqual({
      text: "UPDATE \"users\" SET \"manager_id\" = $1 WHERE id = $2", values: [10, 19],
    });
  });

  it("splits large tables into batches and skips empty ones", async () => {
    // Arrange
    const client = fakeClient();
    const rows = Array.from({ length: target.BATCH_SIZE + 1 }, (_, i) => ({ id: i + 1 }));

    // Act
    await target.insertRows(client, spec("genders"), rows);
    await target.insertRows(client, spec("genders"), []);

    // Assert
    expect(client.calls).toHaveLength(2);
    expect(client.calls[1].values).toHaveLength(spec("genders").columns.length);
  });

  it("moves the identity sequence to the highest id", async () => {
    // Arrange
    const client = fakeClient();

    // Act
    await target.syncSequence(client, spec("audit_logs"));

    // Assert
    expect(client.calls[0].text).toContain("setval(pg_get_serial_sequence($1, 'id'), m.max_id)");
    expect(client.calls[0].text).toContain("FROM \"audit_logs\"");
    expect(client.calls[0].values).toEqual(["audit_logs"]);
  });
});

describe("copyTarget verification", () => {
  it("reads only id, order and verify columns", async () => {
    // Arrange
    const client = fakeClient();

    // Act
    await target.readTargetRows(client, spec("activities_history"));

    // Assert
    expect(client.calls[0].text).toBe("SELECT \"id\", \"valid_to\", \"company_id\", \"valid_from\""
      + " FROM \"activities_history\"");
  });

  it("reports per table and fails when one table differs", async () => {
    // Arrange
    const plan = [
      {
        spec: spec("genders"),
        sourceCount: 2,
        rejected: [{ id: 2 }],
        rows: [{ id: 1, code: "M", name: "Male" }],
      },
      {
        spec: spec("roles"),
        sourceCount: 1,
        rejected: [],
        rows: [{ id: 1, code: "ADMIN", name: "Admin" }],
      },
    ];
    const client = fakeClient((text) => (text.includes("\"genders\"")
      ? { rows: [{ id: 1, code: "M", name: "Male" }] }
      : { rows: [] }));

    // Act
    const report = await target.verifyPlan(client, plan);

    // Assert
    expect(report.ok).toBe(false);
    expect(report.tables
      .map((item) => [item.table, item.ok, item.source, item.skipped, item.actual]))
      .toEqual([["genders", true, 2, 1, 1], ["roles", false, 1, 0, 0]]);
  });
});
