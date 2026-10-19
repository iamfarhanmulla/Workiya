jest.mock("../repositories/auditLog.repository");
jest.mock("../utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const auditLogRepository = require("../repositories/auditLog.repository");
const logger = require("../utils/logger");
const auditService = require("./audit.service");

describe("audit.service.log", () => {
  it("serialises values and normalises optional fields", async () => {
    // Arrange
    auditLogRepository.insert.mockResolvedValue(undefined);

    // Act
    await auditService.log({
      eventType: "AUTH_LOGIN_SUCCESS",
      entityType: "User",
      entityId: 9,
      companyId: 1,
      performedBy: 9,
      oldValue: "plain",
      newValue: { rememberMe: true },
      ipAddress: "1".repeat(60),
      userAgent: "u".repeat(600),
    });

    // Assert
    const entry = auditLogRepository.insert.mock.calls[0][0];
    expect(entry).toMatchObject({
      entityId: "9", oldValue: "plain", newValue: "{\"rememberMe\":true}",
    });
    expect(entry.ipAddress).toHaveLength(45);
    expect(entry.userAgent).toHaveLength(500);
  });

  it("stores nulls for missing optional fields", async () => {
    // Arrange
    auditLogRepository.insert.mockResolvedValue(undefined);

    // Act
    await auditService.log({ eventType: "AUTH_LOGIN_FAILED", entityType: "User" });

    // Assert
    expect(auditLogRepository.insert.mock.calls[0][0]).toMatchObject({
      entityId: null,
      companyId: null,
      performedBy: null,
      oldValue: null,
      newValue: null,
      ipAddress: null,
      userAgent: null,
    });
  });

  it("never throws when the insert fails and logs the failure", async () => {
    // Arrange
    auditLogRepository.insert.mockRejectedValue(new Error("db down"));

    // Act
    const promise = auditService.log({ eventType: "AUTH_LOGOUT", entityType: "User" });

    // Assert
    await expect(promise).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "AUTH_LOGOUT" }),
      "Failed to write audit log",
    );
  });
});
