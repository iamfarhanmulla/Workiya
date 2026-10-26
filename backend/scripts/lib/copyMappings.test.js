const { TABLES, TRIGGER_TABLES, RESET_TABLES } = require("./copyMappings");

const byTarget = (name) => TABLES.find((spec) => spec.target === name);

describe("copyMappings tables", () => {
  it("lists every copied table in foreign-key order", () => {
    // Arrange / Act
    const targets = TABLES.map((spec) => spec.target);

    // Assert
    expect(targets).toEqual([
      "genders", "roles", "companies", "users", "company_terminology",
      "custom_field_definitions", "activity_types", "accounts", "account_assignments",
      "activities", "submissions", "audit_logs", "accounts_history",
      "account_assignments_history", "activities_history", "submissions_history",
    ]);
  });

  it("never reads dropped columns or the tables that are not moved", () => {
    // Arrange
    const sources = TABLES.flatMap((spec) => spec.columns.map((column) => column.source));

    // Act
    const dropped = sources.filter((name) => /^Legacy|RowVersion|TenantId/.test(name));
    const tables = TABLES.map((spec) => spec.source);

    // Assert
    expect(dropped).toEqual([]);
    expect(tables).not.toEqual(expect.arrayContaining(["RefreshTokens"]));
    expect(tables.filter((name) => /Doctors|Tasks|TaskFeedback|SchemaMigrations/.test(name)))
      .toEqual([]);
  });

  it("builds history tables from their table plus valid_to and its skip rules", () => {
    // Arrange
    const accounts = byTarget("accounts");

    // Act
    const history = byTarget("accounts_history");

    // Assert
    expect(history.source).toBe("AccountsHistory");
    expect(history.identity).toBe(false);
    expect(history.orderBy).toEqual(["id", "valid_to"]);
    expect(history.columns.map((column) => column.target))
      .toEqual([...accounts.columns.map((column) => column.target), "valid_to"]);
    expect(history.sameCompanyUsers).toEqual([]);
    expect(history.historyOf).toBe("accounts");
    expect(byTarget("activities_history").parents).toEqual(byTarget("activities").parents);
  });

  it("checks assigned_to strictly and assigned_by unless the user is a super admin", () => {
    // Arrange / Act
    const activities = byTarget("activities");

    // Assert
    expect(activities.sameCompanyUsers).toEqual(["assigned_to"]);
    expect(activities.sameCompanyActors).toEqual(["assigned_by"]);
    expect(byTarget("submissions").sameCompanyUsers).toEqual(["submitted_by"]);
    expect(byTarget("account_assignments").sameCompanyUsers).toEqual(["user_id"]);
  });

  it("selects the hidden SQL Server period column ValidFromUtc by name", () => {
    // Arrange
    const temporal = ["accounts", "account_assignments", "activities", "submissions"];

    // Act
    const withValidFrom = temporal.filter((name) => byTarget(name).columns
      .some((column) => column.source === "ValidFromUtc" && column.target === "valid_from"));

    // Assert
    expect(withValidFrom).toEqual(temporal);
  });

  it("marks jsonb columns and the deferred users.manager_id", () => {
    // Arrange / Act
    const jsonb = TABLES.filter((spec) => !spec.target.endsWith("_history"))
      .flatMap((spec) => spec.columns.filter((column) => column.jsonb)
        .map((column) => `${spec.target}.${column.target}`));

    // Assert
    expect(jsonb).toEqual([
      "custom_field_definitions.options_json", "accounts.extra_fields", "submissions.answers",
      "audit_logs.old_value", "audit_logs.new_value",
    ]);
    expect(byTarget("users").deferred).toEqual(["manager_id"]);
  });

  it("verifies only columns that are copied", () => {
    // Arrange / Act
    const unknown = TABLES.flatMap((spec) => [...spec.orderBy, ...spec.verify]
      .filter((name) => !spec.columns.some((column) => column.target === name))
      .map((name) => `${spec.target}.${name}`));

    // Assert
    expect(unknown).toEqual([]);
  });

  it("resets children before parents and includes refresh_tokens", () => {
    // Arrange / Act
    const usersIndex = RESET_TABLES.indexOf("users");

    // Assert
    expect(RESET_TABLES[0]).toBe("submissions_history");
    expect(RESET_TABLES.indexOf("activities")).toBeLessThan(usersIndex);
    expect(RESET_TABLES).toContain("refresh_tokens");
    expect(TRIGGER_TABLES).toContain("audit_logs");
  });
});
