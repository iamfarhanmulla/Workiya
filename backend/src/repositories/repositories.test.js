const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const userRepository = require("./user.repository");
const refreshTokenRepository = require("./refreshToken.repository");
const auditLogRepository = require("./auditLog.repository");
const { mockPool, rows, affected } = require("../../test/helpers/apiHarness");

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("user.repository", () => {
  it("finds an active user by email with the lockout columns", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 1 })]);

    // Act
    const row = await userRepository.findActiveByEmail("a@b.co");

    // Assert
    expect(row).toEqual({ Id: 1 });
    expect(db.queries[0].inputs).toEqual({ email: "a@b.co" });
    expect(db.queries[0].text).toContain("u.FailedLoginCount, u.LockoutEndUtc");
  });

  it.each([
    ["findActiveByEmail", "x@y.z"],
    ["findActiveById", 9]
  ])("%s returns null when nothing matches", async (method, arg) => {
    // Arrange
    mockPool(mockConnectDb, [rows()]);

    // Act
    const row = await userRepository[method](arg);

    // Assert
    expect(row).toBeNull();
  });

  it("finds an active user by id", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 9 })]);

    // Act
    const row = await userRepository.findActiveById(9);

    // Assert
    expect(row).toEqual({ Id: 9 });
    expect(db.queries[0].inputs).toEqual({ id: 9 });
  });

  it("decides the failure count and lockout in one UPDATE and returns what it wrote", async () => {
    // Arrange
    const lockout = new Date("2026-10-16T12:15:00Z");
    const db = mockPool(mockConnectDb, [rows({ FailedLoginCount: 5, LockoutEndUtc: lockout })]);

    // Act
    const result = await userRepository.recordFailedLogin(4, { maxFailedLogins: 5, lockoutMinutes: 15 });

    // Assert
    expect(result).toEqual({ failedLoginCount: 5, lockoutEndUtc: lockout });
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].inputs).toEqual({ id: 4, maxFailedLogins: 5, lockoutMinutes: 15 });
    expect(db.queries[0].text).toContain(">= @maxFailedLogins THEN DATEADD(minute, @lockoutMinutes, GETUTCDATE())");
    expect(db.queries[0].text).toContain("OUTPUT inserted.FailedLoginCount, inserted.LockoutEndUtc");
  });

  it.each([
    [rows({ FailedLoginCount: 2, LockoutEndUtc: null }), { failedLoginCount: 2, lockoutEndUtc: null }],
    [rows(), { failedLoginCount: 0, lockoutEndUtc: null }]
  ])("maps the recordFailedLogin output %#", async (response, expected) => {
    // Arrange
    mockPool(mockConnectDb, [response]);

    // Act
    const result = await userRepository.recordFailedLogin(4, { maxFailedLogins: 5, lockoutMinutes: 15 });

    // Assert
    expect(result).toEqual(expected);
  });

  it("resets the counters on a successful login", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    await userRepository.recordSuccessfulLogin(4);

    // Assert
    expect(db.queries[0].text).toContain("FailedLoginCount = 0");
    expect(db.queries[0].inputs).toEqual({ id: 4 });
  });

  it("stores a new password hash", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    await userRepository.updatePasswordHash(4, { passwordHash: "$argon2id$x", passwordSalt: "", passwordIterations: 0 });

    // Assert
    expect(db.queries[0].inputs).toEqual({ id: 4, passwordHash: "$argon2id$x", passwordSalt: "", passwordIterations: 0 });
  });
});

describe("refreshToken.repository", () => {
  it("inserts a token, including a NULL company, and returns its id", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: "12" })]);

    // Act
    const id = await refreshTokenRepository.insert({
      userId: 1,
      companyId: null,
      tokenHash: "a".repeat(64),
      familyId: "8a7b5f0e-1f2a-4c3d-9e8f-0123456789ab",
      isPersistent: false,
      expiresAtUtc: new Date(),
      createdByIp: null,
      userAgent: null
    });

    // Assert
    expect(id).toBe("12");
    expect(db.queries[0].inputs.companyId).toBeNull();
    expect(db.queries[0].text).toContain("OUTPUT inserted.Id");
  });

  it.each([
    [rows({ Id: 1 }), { Id: 1 }],
    [rows(), null]
  ])("findByHash returns the row or null %#", async (response, expected) => {
    // Arrange
    mockPool(mockConnectDb, [response]);

    // Act
    const record = await refreshTokenRepository.findByHash("h");

    // Assert
    expect(record).toEqual(expected);
  });

  it.each([
    [1, "b".repeat(64), true],
    [0, undefined, false]
  ])("revokes only a still-live token (rows affected %i)", async (count, replacedBy, expected) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(count)]);

    // Act
    const result = await refreshTokenRepository.revoke(5, "ROTATED", replacedBy);

    // Assert
    expect(result).toBe(expected);
    expect(db.queries[0].text).toContain("WHERE Id = @id AND RevokedAtUtc IS NULL");
    expect(db.queries[0].inputs.replacedByHash).toBe(replacedBy || null);
  });

  it("revokes every live token of a family", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(3)]);

    // Act
    await refreshTokenRepository.revokeFamily("fam", "LOGOUT");

    // Assert
    expect(db.queries[0].inputs).toEqual({ familyId: "fam", reason: "LOGOUT" });
  });
});

describe("auditLog.repository", () => {
  it("appends an audit row", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    await auditLogRepository.insert({ eventType: "E", entityType: "User", entityId: "1", performedBy: 1 });

    // Assert
    expect(db.queries[0].text).toContain("INSERT INTO AuditLogs");
    expect(db.queries[0].inputs).toMatchObject({ eventType: "E", entityType: "User", performedBy: 1 });
  });
});
