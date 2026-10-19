jest.mock("../repositories/user.repository");
jest.mock("../repositories/refreshToken.repository");
jest.mock("./audit.service");
jest.mock("../config/env", () => {
  const actual = jest.requireActual("../config/env");
  return { ...actual, auth: { ...actual.auth } };
});

const config = require("../config/env");
const userRepository = require("../repositories/user.repository");
const refreshTokenRepository = require("../repositories/refreshToken.repository");
const auditService = require("./audit.service");
const passwordService = require("./password.service");
const tokenService = require("./token.service");
const authService = require("./auth.service");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const { TEST_PASSWORD: PASSWORD, HOUR_MS, userRow } = require("../../test/helpers/authFixtures");

const CTX = { ip: "10.0.0.1", userAgent: "jest" };

function auditedEvents() {
  return auditService.log.mock.calls.map(([entry]) => entry.eventType);
}

beforeEach(() => {
  config.auth.passwordRehashOnLogin = false;
  auditService.log.mockResolvedValue(undefined);
  refreshTokenRepository.insert.mockResolvedValue(1);
  userRepository.recordFailedLogin.mockResolvedValue({ failedLoginCount: 1, lockoutEndUtc: null });
});

describe("auth.service.login", () => {
  it("returns a session and records a successful login", async () => {
    // Arrange
    userRepository.findActiveByEmail.mockResolvedValue(userRow());

    // Act
    const session = await authService.login({ email: "mgr@example.com", password: PASSWORD, ...CTX });

    // Assert
    expect(session.user).toMatchObject({ id: 11, roleCode: "MANAGER", email: "mgr@example.com" });
    expect(session.user).not.toHaveProperty("PasswordHash");
    expect(session.isPersistent).toBe(false);
    expect(tokenService.verifyAccessToken(session.accessToken).sub).toBe("11");
    expect(userRepository.recordSuccessfulLogin).toHaveBeenCalledWith(11);
    const inserted = refreshTokenRepository.insert.mock.calls[0][0];
    expect(inserted).toMatchObject({ userId: 11, companyId: 2, isPersistent: false, createdByIp: "10.0.0.1" });
    expect(inserted.tokenHash).toBe(tokenService.hashRefreshToken(session.refreshToken));
    expect(inserted.expiresAtUtc.getTime() - Date.now()).toBeLessThanOrEqual(12 * HOUR_MS);
    expect(auditedEvents()).toEqual([AUDIT_EVENTS.AUTH_LOGIN_SUCCESS]);
  });

  it("creates a 30-day persistent session when rememberMe is true", async () => {
    // Arrange
    userRepository.findActiveByEmail.mockResolvedValue(userRow());

    // Act
    const session = await authService.login({ email: "a@b.co", password: PASSWORD, rememberMe: true });

    // Assert
    const inserted = refreshTokenRepository.insert.mock.calls[0][0];
    expect(session.isPersistent).toBe(true);
    expect(inserted.expiresAtUtc.getTime() - Date.now()).toBeGreaterThan(29 * 24 * HOUR_MS);
    expect(inserted.createdByIp).toBeNull();
    expect(inserted.userAgent).toBeNull();
  });

  it.each([
    ["PBKDF2, the scheme legacy users are stored with", false, "pbkdf2"],
    ["Argon2id once rehash-on-login moves users to it", true, "argon2id"]
  ])("returns the same 401 for an unknown email and burns a %s dummy hash", async (_label, rehash, scheme) => {
    // Arrange
    config.auth.passwordRehashOnLogin = rehash;
    userRepository.findActiveByEmail.mockResolvedValue(null);
    const dummySpy = jest.spyOn(passwordService, "dummyVerify").mockResolvedValue(false);

    // Act
    const promise = authService.login({ email: "x@y.z", password: "p", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({
      status: 401,
      errorCode: "AUTH_INVALID_CREDENTIALS",
      message: "Invalid email or password."
    });
    expect(dummySpy).toHaveBeenCalledWith(scheme);
    expect(auditedEvents()).toEqual([AUDIT_EVENTS.AUTH_LOGIN_FAILED]);
    dummySpy.mockRestore();
  });

  it("returns 401 and records a failed login for a wrong password", async () => {
    // Arrange
    userRepository.findActiveByEmail.mockResolvedValue(userRow({ FailedLoginCount: 1 }));
    userRepository.recordFailedLogin.mockResolvedValue({ failedLoginCount: 2, lockoutEndUtc: null });

    // Act
    const promise = authService.login({ email: "mgr@example.com", password: "wrong", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({
      status: 401,
      errorCode: "AUTH_INVALID_CREDENTIALS",
      message: "Invalid email or password."
    });
    expect(userRepository.recordFailedLogin).toHaveBeenCalledWith(11, { maxFailedLogins: 5, lockoutMinutes: 15 });
    expect(auditService.log.mock.calls[0][0].newValue).toEqual({ reason: "INVALID_PASSWORD", failedLoginCount: 2 });
    expect(refreshTokenRepository.insert).not.toHaveBeenCalled();
  });

  it("uses the count and lockout decided by the database, not the stale row", async () => {
    // Arrange
    const lockoutEndUtc = new Date(Date.now() + 15 * 60 * 1000);
    userRepository.findActiveByEmail.mockResolvedValue(userRow({ FailedLoginCount: 0 }));
    userRepository.recordFailedLogin.mockResolvedValue({ failedLoginCount: 5, lockoutEndUtc });

    // Act
    const promise = authService.login({ email: "mgr@example.com", password: "wrong", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_INVALID_CREDENTIALS" });
    expect(auditedEvents()).toEqual([AUDIT_EVENTS.AUTH_LOGIN_FAILED, AUDIT_EVENTS.AUTH_ACCOUNT_LOCKED]);
    expect(auditService.log.mock.calls[1][0].newValue).toEqual({ lockoutEndUtc: lockoutEndUtc.toISOString() });
  });

  it("does not audit a new lockout while the failure count is below the limit", async () => {
    // Arrange
    const stillLocked = new Date(Date.now() + 60 * 1000);
    userRepository.findActiveByEmail.mockResolvedValue(userRow());
    userRepository.recordFailedLogin.mockResolvedValue({ failedLoginCount: 1, lockoutEndUtc: stillLocked });

    // Act
    const promise = authService.login({ email: "mgr@example.com", password: "wrong", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401 });
    expect(auditedEvents()).toEqual([AUDIT_EVENTS.AUTH_LOGIN_FAILED]);
  });

  it("answers a locked account like a wrong password, after the same hash work", async () => {
    // Arrange
    const future = new Date(Date.now() + 60 * 1000);
    userRepository.findActiveByEmail.mockResolvedValue(userRow({ LockoutEndUtc: future }));
    const verifySpy = jest.spyOn(passwordService, "verifyPassword");

    // Act
    const promise = authService.login({ email: "mgr@example.com", password: PASSWORD, ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({
      status: 401,
      errorCode: "AUTH_INVALID_CREDENTIALS",
      message: "Invalid email or password."
    });
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(userRepository.recordFailedLogin).not.toHaveBeenCalled();
    expect(refreshTokenRepository.insert).not.toHaveBeenCalled();
    expect(auditService.log.mock.calls[0][0].newValue).toEqual({ reason: "LOCKED" });
    verifySpy.mockRestore();
  });

  it("signs in a SUPER_ADMIN without a company and stores a NULL CompanyId", async () => {
    // Arrange
    userRepository.findActiveByEmail.mockResolvedValue(userRow({ CompanyId: null, RoleCode: "SUPER_ADMIN" }));

    // Act
    const session = await authService.login({ email: "admin@example.com", password: PASSWORD, ...CTX });

    // Assert
    expect(session.user).toMatchObject({ companyId: null, roleCode: "SUPER_ADMIN" });
    expect(refreshTokenRepository.insert.mock.calls[0][0].companyId).toBeNull();
    expect(tokenService.verifyAccessToken(session.accessToken).cid).toBeNull();
  });


  it("rehashes a PBKDF2 password to Argon2id when enabled", async () => {
    // Arrange
    config.auth.passwordRehashOnLogin = true;
    userRepository.findActiveByEmail.mockResolvedValue(userRow());

    // Act
    await authService.login({ email: "mgr@example.com", password: PASSWORD, ...CTX });

    // Assert
    const [id, hashed] = userRepository.updatePasswordHash.mock.calls[0];
    expect(id).toBe(11);
    expect(hashed).toMatchObject({ passwordSalt: "", passwordIterations: 0 });
    expect(hashed.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(auditedEvents()).toContain(AUDIT_EVENTS.AUTH_PASSWORD_REHASHED);
  });

  it("does not rehash an Argon2id password even when enabled", async () => {
    // Arrange
    config.auth.passwordRehashOnLogin = true;
    const hashed = await passwordService.hashPassword(PASSWORD);
    userRepository.findActiveByEmail.mockResolvedValue(
      userRow({ PasswordHash: hashed.passwordHash, PasswordSalt: "", PasswordIterations: 0 })
    );

    // Act
    await authService.login({ email: "mgr@example.com", password: PASSWORD, ...CTX });

    // Assert
    expect(userRepository.updatePasswordHash).not.toHaveBeenCalled();
  });
});
