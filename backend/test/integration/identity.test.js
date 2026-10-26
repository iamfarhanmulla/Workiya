const crypto = require("node:crypto");
const {
  useTestDb, closeTestDb, seedBasics, resetData,
} = require("./helpers/testDb");
const userRepository = require("../../src/repositories/user.repository");
const refreshTokenRepository = require("../../src/repositories/refreshToken.repository");
const passwordService = require("../../src/services/password.service");
const passwordReset = require("../../src/services/passwordReset.service");
const { toUserDto } = require("../../src/services/userDto");
const seed = require("../../scripts/seed-super-admin");
const { USERS } = require("../helpers/apiHarness");

const LOCK_POLICY = Object.freeze({ maxFailedLogins: 3, lockoutMinutes: 15 });
const MINUTE_MS = 60 * 1000;
const REQ = Object.freeze({ ip: "10.0.0.9", get: () => "identity-test" });

let db;

function insertToken(userId, companyId) {
  return refreshTokenRepository.insert({
    userId,
    companyId,
    tokenHash: crypto.randomBytes(32).toString("hex"),
    familyId: crypto.randomUUID(),
    isPersistent: true,
    expiresAtUtc: new Date(Date.now() + 60 * MINUTE_MS),
    createdByIp: "10.0.0.1",
    userAgent: "identity-test",
  });
}

async function liveTokenUsers() {
  const { rows } = await db.query(
    "SELECT user_id FROM refresh_tokens WHERE revoked_at IS NULL ORDER BY user_id",
  );
  return rows.map((row) => row.user_id);
}

beforeAll(async () => {
  db = await useTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await seedBasics();
});

describe("user.repository against PostgreSQL", () => {
  it("finds a login by email case-insensitively (citext) with the auth DTO columns", async () => {
    // Act
    const row = await userRepository.findActiveByEmail("EVE@Globex.TEST");

    // Assert
    expect(row).toMatchObject({
      id: 30, company_id: 2, role_code: "EMPLOYEE", failed_login_count: 0, lockout_end_at: null,
    });
    expect(toUserDto(row)).toEqual({
      id: 30,
      companyId: 2,
      roleId: 3,
      roleCode: "EMPLOYEE",
      roleName: "Employee",
      username: "employee",
      email: "eve@globex.test",
      displayName: "Eve Employee",
      firstName: "Eve",
      middleName: null,
      lastName: "Employee",
      phoneNumber: null,
      status: 1,
    });
  });

  it("ignores inactive and deleted users", async () => {
    // Arrange
    await db.query("UPDATE users SET is_active = false WHERE id = 30");
    await db.query("UPDATE users SET is_deleted = true WHERE id = 20");

    // Act
    const inactive = await userRepository.findActiveByEmail("eve@globex.test");
    const deleted = await userRepository.findActiveById(20);

    // Assert
    expect(inactive).toBeNull();
    expect(deleted).toBeNull();
  });

  it("counts failures, locks on the limit and starts over after an expired lockout", async () => {
    // Act
    const first = await userRepository.recordFailedLogin(30, LOCK_POLICY);
    const second = await userRepository.recordFailedLogin(30, LOCK_POLICY);
    const third = await userRepository.recordFailedLogin(30, LOCK_POLICY);
    // Measured on the database clock: the client clock may differ from the server's.
    const lock = await db.query(
      "SELECT lockout_end_at - last_failed_login_at = interval '15 minutes' AS exact"
      + " FROM users WHERE id = 30",
    );
    await db.query(
      "UPDATE users SET lockout_end_at = now() - interval '1 minute' WHERE id = 30",
    );
    const afterExpiry = await userRepository.recordFailedLogin(30, LOCK_POLICY);

    // Assert
    expect([first, second].map((r) => r.failedLoginCount)).toEqual([1, 2]);
    expect(first.lockoutEndUtc).toBeNull();
    expect(second.lockoutEndUtc).toBeNull();
    expect(third.failedLoginCount).toBe(3);
    expect(third.lockoutEndUtc).toBeInstanceOf(Date);
    expect(lock.rows[0].exact).toBe(true);
    expect(afterExpiry).toEqual({ failedLoginCount: 1, lockoutEndUtc: null });
  });

  it("clears the counters on a successful login and stores a rehashed password", async () => {
    // Arrange
    await userRepository.recordFailedLogin(30, LOCK_POLICY);
    const hashed = await passwordService.hashPassword("Rehash#Pass1");

    // Act
    await userRepository.recordSuccessfulLogin(30);
    await userRepository.updatePasswordHash(30, hashed);

    // Assert
    const { rows } = await db.query(
      "SELECT failed_login_count, last_login_at, password_iterations, updated_by"
      + " FROM users WHERE id = 30",
    );
    expect(rows[0])
      .toMatchObject({ failed_login_count: 0, password_iterations: 0, updated_by: 30 });
    expect(rows[0].last_login_at).toBeInstanceOf(Date);
    const row = await userRepository.findActiveByEmail("eve@globex.test");
    await expect(passwordService.verifyPassword(row, "Rehash#Pass1")).resolves.toBe(true);
  });
});

describe("refreshToken.repository against PostgreSQL", () => {
  it("stores, finds, rotates and revokes tokens by family", async () => {
    // Arrange
    const id = await insertToken(30, 2);
    const { rows } = await db.query("SELECT token_hash FROM refresh_tokens WHERE id = @id", { id });
    const tokenHash = rows[0].token_hash;

    // Act
    const found = await refreshTokenRepository.findByHash(tokenHash);
    const rotated = await refreshTokenRepository.revoke(id, "ROTATED", "b".repeat(64));
    const again = await refreshTokenRepository.revoke(id, "ROTATED");
    await refreshTokenRepository.revokeFamily(found.family_id, "LOGOUT");

    // Assert
    expect(typeof id).toBe("number");
    expect(found).toMatchObject({
      id, user_id: 30, company_id: 2, is_persistent: true,
    });
    expect(found.expires_at).toBeInstanceOf(Date);
    expect(rotated).toBe(true);
    expect(again).toBe(false);
    const after = await refreshTokenRepository.findByHash(tokenHash);
    expect(after)
      .toMatchObject({ revoked_reason: "ROTATED", replaced_by_token_hash: "b".repeat(64) });
  });
});

describe("password reset against PostgreSQL", () => {
  it("stores Argon2id, clears lockout and revokes only that user's sessions, "
    + "then audits", async () => {
    // Arrange
    await insertToken(30, 2);
    await insertToken(30, 2);
    await insertToken(20, 2);
    await db.query("UPDATE users SET failed_login_count = 4, lockout_end_at = now() WHERE id = 30");

    // Act
    const result = await passwordReset.resetPassword(USERS.admin, "30", "N3w-Passw0rd!", REQ);

    // Assert
    expect(result).toEqual({ updated: true, revokedSessions: 2 });
    await expect(liveTokenUsers()).resolves.toEqual([20]);
    const { rows } = await db.query(
      "SELECT password_hash, password_salt, password_iterations, failed_login_count,"
      + " lockout_end_at, last_password_changed_at, updated_by FROM users WHERE id = 30",
    );
    expect(rows[0]).toMatchObject({
      password_salt: "",
      password_iterations: 0,
      failed_login_count: 0,
      lockout_end_at: null,
      updated_by: USERS.admin.id,
    });
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(rows[0].last_password_changed_at).toBeInstanceOf(Date);
    const audit = await db.query(
      "SELECT new_value, performed_by FROM audit_logs"
      + " WHERE event_type = 'USER_PASSWORD_RESET' AND entity_id = '30'"
      + " ORDER BY id DESC LIMIT 1",
    );
    expect(audit.rows[0]).toEqual({
      new_value: { revokedSessions: 2 }, performed_by: USERS.admin.id,
    });
  });

  it("rolls the password back when revoking the sessions fails", async () => {
    // Arrange
    await insertToken(30, 2);
    const before = await db.query("SELECT password_hash FROM users WHERE id = 30");
    await db.query(`CREATE FUNCTION fail_revoke() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'revoke failed'; END $$`);
    await db.query(`CREATE TRIGGER trg_fail_revoke BEFORE UPDATE ON refresh_tokens
      FOR EACH ROW EXECUTE FUNCTION fail_revoke()`);

    try {
      // Act
      const run = passwordReset.resetPassword(USERS.admin, 30, "N3w-Passw0rd!", REQ);

      // Assert
      await expect(run).rejects.toThrow("revoke failed");
      const after = await db.query("SELECT password_hash FROM users WHERE id = 30");
      expect(after.rows[0].password_hash).toBe(before.rows[0].password_hash);
    } finally {
      await db.query("DROP TRIGGER trg_fail_revoke ON refresh_tokens; DROP FUNCTION fail_revoke()");
    }
  });
});

describe("seed-super-admin against PostgreSQL", () => {
  const INPUT = Object.freeze({
    email: "Owner@Workiya.test",
    password: "Seed#Passw0rd",
    companyName: "Workiya",
    key: "workiya",
  });

  it("creates the roles, the first company and an Argon2id SUPER_ADMIN only once", async () => {
    // Arrange
    await resetData();

    // Act
    const first = await seed.seedSuperAdmin(db, INPUT);
    const second = await seed.seedSuperAdmin(db, INPUT);

    // Assert
    expect(first).toMatchObject({ created: true });
    expect(second).toEqual({ created: false, userId: first.userId });
    const roles = await db.query("SELECT code FROM roles ORDER BY code");
    expect(roles.rows.map((r) => r.code))
      .toEqual(["ADMIN", "EMPLOYEE", "MANAGER", "SUPER_ADMIN"]);
    const row = await userRepository.findActiveByEmail("owner@workiya.test");
    expect(row).toMatchObject({ id: first.userId, company_id: first.companyId });
    expect(row.role_code).toBe("SUPER_ADMIN");
    await expect(passwordService.verifyPassword(row, INPUT.password)).resolves.toBe(true);
  });

  it("leaves an existing SUPER_ADMIN alone", async () => {
    // Act
    const result = await seed.seedSuperAdmin(db, INPUT);

    // Assert
    expect(result).toEqual({ created: false, userId: 1 });
  });
});
