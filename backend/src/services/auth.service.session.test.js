jest.mock("../repositories/user.repository");
jest.mock("../repositories/refreshToken.repository");
jest.mock("./audit.service");

const userRepository = require("../repositories/user.repository");
const refreshTokenRepository = require("../repositories/refreshToken.repository");
const auditService = require("./audit.service");
const tokenService = require("./token.service");
const authService = require("./auth.service");
const { AUDIT_EVENTS } = require("../constants/auditEvents");
const { userRow, tokenRecord, installFakeTokenStore } = require("../../test/helpers/authFixtures");

const CTX = { ip: "10.0.0.1", userAgent: "jest" };

function auditedEvents() {
  return auditService.log.mock.calls.map(([entry]) => entry.eventType);
}

beforeEach(() => {
  auditService.log.mockResolvedValue(undefined);
  refreshTokenRepository.insert.mockResolvedValue(1);
  refreshTokenRepository.revoke.mockResolvedValue(true);
});

describe("auth.service.refresh", () => {
  it("rejects a missing token", async () => {
    // Arrange / Act
    const promise = authService.refresh({ refreshToken: undefined, ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_REFRESH_INVALID" });
  });

  it("rejects an unknown token", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(null);

    // Act
    const promise = authService.refresh({ refreshToken: "nope", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_REFRESH_INVALID" });
  });

  it("rejects an expired token", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord({ ExpiresAtUtc: new Date(Date.now() - 1) }));

    // Act
    const promise = authService.refresh({ refreshToken: "old", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ errorCode: "AUTH_REFRESH_INVALID" });
    expect(refreshTokenRepository.revoke).not.toHaveBeenCalled();
  });

  it.each([
    ["revoked", { RevokedAtUtc: new Date(), RevokedReason: "LOGOUT" }],
    ["replaced", { ReplacedByTokenHash: "a".repeat(64) }],
    ["long-rotated", { RevokedAtUtc: new Date(Date.now() - 31 * 1000), RevokedReason: "ROTATED" }]
  ])("revokes the whole family when a %s token is reused", async (_label, overrides) => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord(overrides));

    // Act
    const promise = authService.refresh({ refreshToken: "stolen", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_REFRESH_REUSED" });
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith("fam-1", "REUSE_DETECTED");
    expect(auditedEvents()).toEqual([AUDIT_EVENTS.AUTH_REFRESH_REUSE_DETECTED]);
  });

  it("answers a token rotated by another tab moments ago without new tokens or a family revoke", async () => {
    // Arrange
    const record = tokenRecord({ RevokedAtUtc: new Date(Date.now() - 2000), RevokedReason: "ROTATED", ReplacedByTokenHash: "b".repeat(64) });
    refreshTokenRepository.findByHash.mockResolvedValue(record);
    userRepository.findActiveById.mockResolvedValue(userRow());

    // Act
    const session = await authService.refresh({ refreshToken: "just-rotated", ...CTX });

    // Assert
    expect(session).toEqual({ user: expect.objectContaining({ id: 11 }), rotatedConcurrently: true });
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
    expect(refreshTokenRepository.insert).not.toHaveBeenCalled();
  });

  it("rejects a just-rotated token when the user is no longer active", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord({ RevokedAtUtc: new Date(), RevokedReason: "ROTATED" }));
    userRepository.findActiveById.mockResolvedValue(null);

    // Act
    const promise = authService.refresh({ refreshToken: "just-rotated", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_REFRESH_INVALID" });
  });

  it("revokes its own new token and answers like a concurrent tab when it loses the rotation race", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord());
    userRepository.findActiveById.mockResolvedValue(userRow());
    refreshTokenRepository.insert.mockResolvedValue(555);
    refreshTokenRepository.revoke.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    // Act
    const session = await authService.refresh({ refreshToken: "raced", ...CTX });

    // Assert
    expect(session.rotatedConcurrently).toBe(true);
    expect(session).not.toHaveProperty("refreshToken");
    expect(refreshTokenRepository.revoke).toHaveBeenLastCalledWith(555, "RACE_LOST");
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
  });

  it("stores the new token before revoking the old one, so a family revoke always covers it", async () => {
    // Arrange
    const order = [];
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord());
    userRepository.findActiveById.mockResolvedValue(userRow());
    refreshTokenRepository.insert.mockImplementation(async () => { order.push("insert"); return 7; });
    refreshTokenRepository.revoke.mockImplementation(async () => { order.push("revoke"); return true; });

    // Act
    await authService.refresh({ refreshToken: "valid", ...CTX });

    // Assert
    expect(order).toEqual(["insert", "revoke"]);
  });

  it("lets two tabs refresh the same token at once without signing the user out", async () => {
    // Arrange
    const store = installFakeTokenStore(refreshTokenRepository);
    userRepository.findActiveById.mockResolvedValue(userRow());
    const original = "shared-cookie";
    store.push({ ...tokenRecord({ Id: 900 }), TokenHash: tokenService.hashRefreshToken(original) });

    // Act
    const first = await authService.refresh({ refreshToken: original, ...CTX });
    const second = await authService.refresh({ refreshToken: original, ...CTX });

    // Assert
    expect(first.refreshToken).toEqual(expect.any(String));
    expect(second.rotatedConcurrently).toBe(true);
    const live = store.filter((t) => !t.RevokedAtUtc);
    expect(live).toHaveLength(1);
    expect(live[0].TokenHash).toBe(tokenService.hashRefreshToken(first.refreshToken));
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
  });

  it("revokes the family and rejects when the user is no longer active", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord());
    userRepository.findActiveById.mockResolvedValue(null);

    // Act
    const promise = authService.refresh({ refreshToken: "valid", ...CTX });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_REFRESH_INVALID" });
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith("fam-1", "USER_INACTIVE");
  });

  it("rotates the token, keeping family, persistence and absolute expiry", async () => {
    // Arrange
    const record = tokenRecord({ IsPersistent: false });
    refreshTokenRepository.findByHash.mockResolvedValue(record);
    userRepository.findActiveById.mockResolvedValue(userRow());

    // Act
    const session = await authService.refresh({ refreshToken: "valid", ...CTX });

    // Assert
    const newHash = tokenService.hashRefreshToken(session.refreshToken);
    expect(refreshTokenRepository.findByHash).toHaveBeenCalledWith(tokenService.hashRefreshToken("valid"));
    expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(100, "ROTATED", newHash);
    expect(refreshTokenRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        familyId: "fam-1",
        isPersistent: false,
        tokenHash: newHash,
        expiresAtUtc: record.ExpiresAtUtc
      })
    );
    expect(session.user.id).toBe(11);
    expect(session.refreshToken).not.toBe("valid");
  });
});

describe("auth.service.logout", () => {
  it("does nothing without a token", async () => {
    // Arrange / Act
    await authService.logout({ refreshToken: undefined, ...CTX });

    // Assert
    expect(refreshTokenRepository.findByHash).not.toHaveBeenCalled();
  });

  it("does nothing for an unknown token", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(null);

    // Act
    await authService.logout({ refreshToken: "x", ...CTX });

    // Assert
    expect(refreshTokenRepository.revokeFamily).not.toHaveBeenCalled();
  });

  it("revokes the token family and audits the logout", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockResolvedValue(tokenRecord());

    // Act
    await authService.logout({ refreshToken: "x", ...CTX });

    // Assert
    expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith("fam-1", "LOGOUT");
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: AUDIT_EVENTS.AUTH_LOGOUT, performedBy: 11, ipAddress: "10.0.0.1" })
    );
  });
});

describe("auth.service.me", () => {
  it("returns the user DTO", async () => {
    // Arrange
    userRepository.findActiveById.mockResolvedValue(userRow());

    // Act
    const user = await authService.me(11);

    // Assert
    expect(user).toEqual(expect.objectContaining({ id: 11, roleName: "Manager" }));
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("rejects when the user is gone", async () => {
    // Arrange
    userRepository.findActiveById.mockResolvedValue(null);

    // Act
    const promise = authService.me(11);

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 401, errorCode: "AUTH_REQUIRED" });
  });
});
