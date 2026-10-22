jest.mock("../repositories/activityType.repository", () => ({
  list: jest.fn(),
  findById: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  countOpenActivities: jest.fn(),
  softDelete: jest.fn(),
}));
jest.mock("./audit.service", () => ({ log: jest.fn() }));

const activityTypeRepository = require("../repositories/activityType.repository");
const auditService = require("./audit.service");
const service = require("./activityTypeSettings.service");

const CTX = {
  companyId: 2, userId: 10, ip: "10.0.0.1", userAgent: "jest",
};

function typeRow(overrides = {}) {
  return {
    Id: 4,
    CompanyId: 2,
    Code: "VISIT",
    Name: "Visit",
    RequiresCheckIn: true,
    GeofenceMeters: null,
    MinPhotos: 1,
    RequiresSignature: false,
    RequiresCustomerOtp: false,
    IsActive: true,
    ...overrides,
  };
}

const TYPE = { code: "VISIT", name: "Visit" };

describe("activityTypeSettings.service", () => {
  it("lists activity types as DTOs", async () => {
    // Arrange
    activityTypeRepository.list.mockResolvedValue([typeRow({ GeofenceMeters: 200 })]);

    // Act
    const types = await service.listActivityTypes(2, { includeInactive: false });

    // Assert
    expect(activityTypeRepository.list).toHaveBeenCalledWith(2, { includeInactive: false });
    expect(types).toEqual([{
      id: 4,
      code: "VISIT",
      name: "Visit",
      requiresCheckIn: true,
      geofenceMeters: 200,
      minPhotos: 1,
      requiresSignature: false,
      requiresCustomerOtp: false,
      isActive: true,
    }]);
  });

  it("creates a type and audits it", async () => {
    // Arrange
    activityTypeRepository.insert.mockResolvedValue(typeRow());

    // Act
    const dto = await service.createActivityType(CTX, TYPE);

    // Assert
    expect(activityTypeRepository.insert).toHaveBeenCalledWith(2, TYPE, 10);
    expect(dto.geofenceMeters).toBeNull();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_TYPE_CREATED", entityType: "ActivityType", entityId: 4,
    }));
  });

  it("turns a duplicate code into 409 CONFLICT", async () => {
    // Arrange
    const duplicate = Object.assign(new Error("dup"), { number: 2627 });
    activityTypeRepository.insert.mockRejectedValue(duplicate);

    // Act
    const promise = service.createActivityType(CTX, TYPE);

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });

  it("rethrows other errors", async () => {
    // Arrange
    activityTypeRepository.insert.mockRejectedValue(new Error("db down"));

    // Act
    const promise = service.createActivityType(CTX, TYPE);

    // Assert
    await expect(promise).rejects.toThrow("db down");
  });

  it("updates a type and audits before/after", async () => {
    // Arrange
    activityTypeRepository.findById.mockResolvedValue(typeRow());
    activityTypeRepository.update.mockResolvedValue(typeRow({ Name: "Field visit" }));

    // Act
    const dto = await service.updateActivityType(CTX, 4, { ...TYPE, name: "Field visit" });

    // Assert
    expect(dto.name).toBe("Field visit");
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_TYPE_UPDATED",
      oldValue: expect.objectContaining({ name: "Visit" }),
      newValue: expect.objectContaining({ name: "Field visit" }),
    }));
  });

  it.each([
    ["missing", null, null],
    ["vanished", typeRow(), null],
  ])("returns 404 when the type is %s on update", async (_label, found, updated) => {
    // Arrange
    activityTypeRepository.findById.mockResolvedValue(found);
    activityTypeRepository.update.mockResolvedValue(updated);

    // Act
    const promise = service.updateActivityType(CTX, 4, TYPE);

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
  });

  it("soft deletes an unused type", async () => {
    // Arrange
    activityTypeRepository.findById.mockResolvedValue(typeRow());
    activityTypeRepository.countOpenActivities.mockResolvedValue(0);
    activityTypeRepository.softDelete.mockResolvedValue(true);

    // Act
    await service.deleteActivityType(CTX, 4);

    // Assert
    expect(activityTypeRepository.softDelete).toHaveBeenCalledWith(2, 4, 10);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_TYPE_DELETED", newValue: null,
    }));
  });

  it("refuses to delete a type used by open activities", async () => {
    // Arrange
    activityTypeRepository.findById.mockResolvedValue(typeRow());
    activityTypeRepository.countOpenActivities.mockResolvedValue(3);

    // Act
    const promise = service.deleteActivityType(CTX, 4);

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(activityTypeRepository.softDelete).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, true],
    ["already deleted", typeRow(), false],
  ])("returns 404 when deleting a %s type", async (_label, found, deleted) => {
    // Arrange
    activityTypeRepository.findById.mockResolvedValue(found);
    activityTypeRepository.countOpenActivities.mockResolvedValue(0);
    activityTypeRepository.softDelete.mockResolvedValue(deleted);

    // Act
    const promise = service.deleteActivityType(CTX, 4);

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 404 });
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
