const { mockDb, rows, affected } = require("../test/helpers/mockDb");
const seed = require("./seed-super-admin");

const ENV = Object.freeze({
  DATABASE_URL_DIRECT: "postgres://seed.invalid/db",
  SEED_ADMIN_EMAIL: " owner@workiya.test ",
  SEED_ADMIN_PASSWORD: "Seed#Passw0rd",
});

function runMain(argv, { env = ENV, db = mockDb() } = {}) {
  const output = [];
  const result = seed.main(["node", "seed", ...argv], {
    env, db, out: (text) => output.push(text),
  });
  return { result, output, db };
}

describe("seed-super-admin parseArgs", () => {
  it("defaults to a dry run on DATABASE_URL_DIRECT", () => {
    // Act
    const options = seed.parseArgs(["node", "seed"]);

    // Assert
    expect(options).toEqual({ confirmed: false, urlEnv: "DATABASE_URL_DIRECT" });
  });

  it("reads --yes and --url-env", () => {
    // Act
    const options = seed.parseArgs(["node", "seed", "--yes", "--url-env", "DATABASE_URL_TEST"]);

    // Assert
    expect(options).toEqual({ confirmed: true, urlEnv: "DATABASE_URL_TEST" });
  });
});

describe("seed-super-admin readSeedInput", () => {
  it("trims the email and derives the company key", () => {
    // Act
    const input = seed.readSeedInput({ ...ENV, SEED_COMPANY_NAME: "Acme Health, Inc." });

    // Assert
    expect(input).toEqual({
      email: "owner@workiya.test",
      password: "Seed#Passw0rd",
      companyName: "Acme Health, Inc.",
      key: "acme-health-inc",
    });
  });

  it.each([
    ["a missing email", { SEED_ADMIN_EMAIL: undefined }, /SEED_ADMIN_EMAIL/],
    ["an invalid email", { SEED_ADMIN_EMAIL: "nobody" }, /SEED_ADMIN_EMAIL/],
    ["a short password", { SEED_ADMIN_PASSWORD: "short" }, /SEED_ADMIN_PASSWORD/],
  ])("rejects %s", (_label, overrides, message) => {
    // Act
    const read = () => seed.readSeedInput({ ...ENV, ...overrides });

    // Assert
    expect(read).toThrow(message);
  });
});

describe("seed-super-admin main", () => {
  it("does nothing when a SUPER_ADMIN already exists", async () => {
    // Arrange
    const db = mockDb([rows({ id: 1 })]);

    // Act
    const { result, output } = runMain(["--yes"], { db });

    // Assert
    await expect(result).resolves.toBe(0);
    expect(output.join("")).toContain("a SUPER_ADMIN already exists (user id 1)");
    expect(db.configure).toHaveBeenCalledWith({ url: ENV.DATABASE_URL_DIRECT });
    expect(db.closePool).toHaveBeenCalled();
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it("only reports what it would do without --yes", async () => {
    // Arrange
    const db = mockDb([rows()]);

    // Act
    const { result, output } = runMain([], { db });

    // Assert
    await expect(result).resolves.toBe(1);
    expect(output.join("")).toContain("Dry run only");
    expect(output.join("")).not.toContain(ENV.SEED_ADMIN_PASSWORD);
    expect(db.withTransaction).not.toHaveBeenCalled();
  });

  it("creates the company and an Argon2id SUPER_ADMIN in one locked transaction", async () => {
    // Arrange
    const db = mockDb([
      rows(), rows(), rows(), affected(4), affected(1), rows({ id: 3 }), rows({ id: 9 }),
    ]);

    // Act
    const { result, output } = runMain(["--yes"], { db });

    // Assert
    await expect(result).resolves.toBe(0);
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const statements = db.statements();
    expect(statements[1].text).toContain("pg_advisory_xact_lock");
    expect(statements[3].params.codes)
      .toEqual(["SUPER_ADMIN", "ADMIN", "EMPLOYEE", "MANAGER"]);
    expect(statements[4].params).toEqual({ companyName: "Workiya", key: "workiya" });
    const insert = statements[6].params;
    expect(insert).toMatchObject({
      companyId: 3,
      email: "owner@workiya.test",
      username: "owner",
      passwordSalt: "",
      passwordIterations: 0,
    });
    expect(insert.passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(db.calls)).not.toContain(ENV.SEED_ADMIN_PASSWORD);
    expect(output.join("")).toContain("Created SUPER_ADMIN owner@workiya.test (user id 9)");
  });

  it("stops when another run created the SUPER_ADMIN first", async () => {
    // Arrange
    const db = mockDb([rows(), rows(), rows({ id: 5 })]);

    // Act
    const { result, output } = runMain(["--yes"], { db });

    // Assert
    await expect(result).resolves.toBe(0);
    expect(output.join("")).toContain("user id 5");
    expect(db.statements()).toHaveLength(3);
  });

  it("prints usage when --url-env has no value", async () => {
    // Act
    const { result, output } = runMain(["--url-env"]);

    // Assert
    await expect(result).resolves.toBe(1);
    expect(output.join("")).toContain("Usage:");
  });

  it("fails without touching a database when the URL variable is not set", async () => {
    // Arrange
    const db = mockDb();

    // Act
    const { result } = runMain([], { env: { ...ENV, DATABASE_URL_DIRECT: "" }, db });

    // Assert
    await expect(result).rejects.toThrow("DATABASE_URL_DIRECT is not set.");
    expect(db.configure).not.toHaveBeenCalled();
  });
});
