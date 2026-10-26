jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const userRepository = require("./user.repository");
const refreshTokenRepository = require("./refreshToken.repository");
const auditLogRepository = require("./auditLog.repository");
const { rows, affected } = require("../../test/helpers/mockDb");

beforeEach(() => {
  db.reset();
});

describe("user.repository", () => {
  it("finds an active user by email with the password and lockout columns", async () => {
    // Arrange
    db.reset([rows({ id: 1 })]);

    // Act
    const row = await userRepository.findActiveByEmail("A@B.co");

    // Assert
    expect(row).toEqual({ id: 1 });
    expect(db.calls[0].params).toEqual({ email: "A@B.co" });
    expect(db.calls[0].text).toContain("u.failed_login_count, u.lockout_end_at");
    expect(db.calls[0].text).toContain("WHERE u.email = @email AND u.is_active");
    expect(db.calls[0].text).toContain("LIMIT 1");
  });

  it.each([
    ["findActiveByEmail", "x@y.z"],
    ["findActiveById", 9],
  ])("%s returns null when nothing matches", async (method, arg) => {
    // Arrange
    db.reset([rows()]);

    // Act
    const row = await userRepository[method](arg);

    // Assert
    expect(row).toBeNull();
  });

  it("finds an active user by id", async () => {
    // Arrange
    db.reset([rows({ id: 9 })]);

    // Act
    const row = await userRepository.findActiveById(9);

    // Assert
    expect(row).toEqual({ id: 9 });
    expect(db.calls[0].params).toEqual({ id: 9 });
    expect(db.calls[0].text).toContain("r.code AS role_code");
  });

  it("decides the failure count and lockout in one UPDATE and returns what it wrote", async () => {
    // Arrange
    const lockout = new Date("2026-10-16T12:15:00Z");
    db.reset([rows({ failed_login_count: 5, lockout_end_at: lockout })]);

    // Act
    const result = await userRepository.recordFailedLogin(4, {
      maxFailedLogins: 5, lockoutMinutes: 15,
    });

    // Assert
    expect(result).toEqual({ failedLoginCount: 5, lockoutEndUtc: lockout });
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].params).toEqual({ id: 4, maxFailedLogins: 5, lockoutMinutes: 15 });
    expect(db.calls[0].text).toContain("THEN now() + make_interval(mins => @lockoutMinutes::int)");
    expect(db.calls[0].text).toContain("RETURNING failed_login_count, lockout_end_at");
  });

  it.each([
    [
      rows({ failed_login_count: 2, lockout_end_at: null }),
      { failedLoginCount: 2, lockoutEndUtc: null },
    ],
    [rows(), { failedLoginCount: 0, lockoutEndUtc: null }],
  ])("maps the recordFailedLogin result %#", async (response, expected) => {
    // Arrange
    db.reset([response]);

    // Act
    const result = await userRepository.recordFailedLogin(4, {
      maxFailedLogins: 5, lockoutMinutes: 15,
    });

    // Assert
    expect(result).toEqual(expected);
  });

  it("resets the counters on a successful login", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    await userRepository.recordSuccessfulLogin(4);

    // Assert
    expect(db.calls[0].text).toContain("failed_login_count = 0");
    expect(db.calls[0].text).toContain("last_login_at = now()");
    expect(db.calls[0].params).toEqual({ id: 4 });
  });

  it("stores a new password hash", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    await userRepository.updatePasswordHash(4, {
      passwordHash: "$argon2id$x", passwordSalt: "", passwordIterations: 0,
    });

    // Assert
    expect(db.calls[0].params).toEqual({
      id: 4, passwordHash: "$argon2id$x", passwordSalt: "", passwordIterations: 0,
    });
    expect(db.calls[0].text).toContain("updated_by = @id");
  });
});

const TOKEN = Object.freeze({
  userId: 1,
  tokenHash: "a".repeat(64),
  familyId: "8a7b5f0e-1f2a-4c3d-9e8f-0123456789ab",
  isPersistent: 1,
  expiresAtUtc: new Date("2026-11-01T00:00:00Z"),
});

describe("refreshToken.repository", () => {
  it("inserts a token, defaulting the optional fields to NULL, and returns its id", async () => {
    // Arrange
    db.reset([rows({ id: 12 })]);

    // Act
    const id = await refreshTokenRepository.insert(TOKEN);

    // Assert
    expect(id).toBe(12);
    expect(db.calls[0].text).toContain("RETURNING id");
    expect(db.calls[0].params).toEqual({
      userId: 1,
      companyId: null,
      tokenHash: TOKEN.tokenHash,
      familyId: TOKEN.familyId,
      isPersistent: true,
      expiresAt: TOKEN.expiresAtUtc,
      createdByIp: null,
      userAgent: null,
    });
  });

  it("inserts the company, IP and user agent when given", async () => {
    // Arrange
    db.reset([rows({ id: 13 })]);

    // Act
    await refreshTokenRepository.insert({
      ...TOKEN, companyId: 2, createdByIp: "10.0.0.1", userAgent: "jest",
    });

    // Assert
    expect(db.calls[0].params)
      .toMatchObject({ companyId: 2, createdByIp: "10.0.0.1", userAgent: "jest" });
  });

  it.each([
    [rows({ id: 1 }), { id: 1 }],
    [rows(), null],
  ])("findByHash returns the row or null %#", async (response, expected) => {
    // Arrange
    db.reset([response]);

    // Act
    const record = await refreshTokenRepository.findByHash("h");

    // Assert
    expect(record).toEqual(expected);
    expect(db.calls[0].params).toEqual({ tokenHash: "h" });
  });

  it.each([
    [1, "b".repeat(64), true],
    [0, undefined, false],
  ])("revokes only a still-live token (rows affected %i)", async (count, replacedBy, expected) => {
    // Arrange
    db.reset([affected(count)]);

    // Act
    const result = await refreshTokenRepository.revoke(5, "ROTATED", replacedBy);

    // Assert
    expect(result).toBe(expected);
    expect(db.calls[0].text).toContain("WHERE id = @id AND revoked_at IS NULL");
    expect(db.calls[0].params.replacedByHash).toBe(replacedBy || null);
  });

  it("revokes every live token of a family", async () => {
    // Arrange
    db.reset([affected(3)]);

    // Act
    await refreshTokenRepository.revokeFamily("fam", "LOGOUT");

    // Assert
    expect(db.calls[0].params).toEqual({ familyId: "fam", reason: "LOGOUT" });
    expect(db.calls[0].text).toContain("WHERE family_id = @familyId AND revoked_at IS NULL");
  });
});

describe("auditLog.repository", () => {
  it("appends an audit row with NULL defaults", async () => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    await auditLogRepository.insert({ eventType: "E", entityType: "User" });

    // Assert
    expect(db.calls[0].text).toContain("INSERT INTO audit_logs");
    expect(db.calls[0].text).toContain("@oldValue::jsonb, @newValue::jsonb");
    expect(db.calls[0].params).toEqual({
      eventType: "E",
      entityType: "User",
      entityId: null,
      companyId: null,
      performedBy: null,
      oldValue: null,
      newValue: null,
      ipAddress: null,
      userAgent: null,
    });
  });

  it.each([
    ["JSON text as is", "{\"a\":1}", "{\"a\":1}"],
    ["plain text as a JSON string", "not json", "\"not json\""],
    ["an object as JSON", { b: 2 }, "{\"b\":2}"],
  ])("stores %s", async (_label, value, stored) => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    await auditLogRepository.insert({
      eventType: "E", entityType: "User", entityId: "1", performedBy: 1, newValue: value,
    });

    // Assert
    expect(db.calls[0].params).toMatchObject({ entityId: "1", performedBy: 1, newValue: stored });
  });
});
