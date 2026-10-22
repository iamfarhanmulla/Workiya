jest.mock("../repositories/userPassword.repository", () => ({ resetPassword: jest.fn() }));
jest.mock("./audit.service", () => ({ log: jest.fn() }));

const userPasswordRepository = require("../repositories/userPassword.repository");
const auditService = require("./audit.service");
const service = require("./passwordReset.service");

const ACTOR = { id: 1, companyId: 2, roleCode: "ADMIN" };
const REQ = { ip: "10.0.0.5", get: () => "jest-agent" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("passwordReset.service readNewPassword", () => {
  it.each([undefined, null, ""])("treats %p as 'keep the current password'", (value) => {
    // Arrange
    const body = { password: value };

    // Act
    const result = service.readNewPassword(body);

    // Assert
    expect(result).toEqual({ password: null, error: null });
  });

  it("rejects a password shorter than the minimum", () => {
    // Arrange
    const body = { password: "short" };

    // Act
    const result = service.readNewPassword(body);

    // Assert
    expect(result).toEqual({ password: null, error: service.PASSWORD_RULE });
  });

  it("rejects a non-string password", () => {
    // Arrange
    const body = { password: 12345678 };

    // Act
    const result = service.readNewPassword(body);

    // Assert
    expect(result.error).toBe(service.PASSWORD_RULE);
  });

  it("accepts a valid password", () => {
    // Arrange
    const body = { password: "N3w-Passw0rd" };

    // Act
    const result = service.readNewPassword(body);

    // Assert
    expect(result).toEqual({ password: "N3w-Passw0rd", error: null });
  });

  it("handles a missing body", () => {
    // Act
    const result = service.readNewPassword(undefined);

    // Assert
    expect(result).toEqual({ password: null, error: null });
  });
});

describe("passwordReset.service resetPassword", () => {
  it("stores a hash (never the plain password) and audits without the password", async () => {
    // Arrange
    userPasswordRepository.resetPassword.mockResolvedValue({ updated: true, revokedSessions: 2 });

    // Act
    const result = await service.resetPassword(ACTOR, "7", "N3w-Passw0rd", REQ);

    // Assert
    expect(result).toEqual({ updated: true, revokedSessions: 2 });
    const entry = userPasswordRepository.resetPassword.mock.calls[0][0];
    expect(entry).toMatchObject({ userId: 7, updatedBy: 1, passwordIterations: 10000 });
    expect(entry.passwordHash).not.toBe("N3w-Passw0rd");
    expect(entry.passwordSalt).toEqual(expect.any(String));
    const audit = auditService.log.mock.calls[0][0];
    expect(audit).toMatchObject({
      eventType: "USER_PASSWORD_RESET",
      entityType: "User",
      entityId: 7,
      companyId: 2,
      performedBy: 1,
      newValue: { revokedSessions: 2 },
      ipAddress: "10.0.0.5",
      userAgent: "jest-agent",
    });
    expect(JSON.stringify(audit)).not.toContain("N3w-Passw0rd");
  });

  it("audits a SUPER_ADMIN reset with no company", async () => {
    // Arrange
    userPasswordRepository.resetPassword.mockResolvedValue({ updated: true, revokedSessions: 0 });
    const superAdmin = { id: 9, roleCode: "SUPER_ADMIN" };
    const req = { ip: "10.0.0.6", get: () => undefined };

    // Act
    await service.resetPassword(superAdmin, 7, "N3w-Passw0rd", req);

    // Assert
    expect(auditService.log.mock.calls[0][0]).toMatchObject({ companyId: null, userAgent: "" });
  });
});

describe("passwordReset.service updatedMessage", () => {
  it("mentions the sign-out only when the password changed", () => {
    // Act
    const changed = service.updatedMessage("User", true);
    const unchanged = service.updatedMessage("User", false);

    // Assert
    expect(changed).toBe("User updated. Password changed and all their sessions were signed out.");
    expect(unchanged).toBe("User updated.");
  });
});
