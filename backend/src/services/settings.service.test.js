jest.mock("../repositories/terminology.repository", () => ({
  listByCompany: jest.fn(),
  upsertLabels: jest.fn(),
}));
jest.mock("../repositories/customField.repository", () => ({
  list: jest.fn(),
  findById: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
}));
jest.mock("./audit.service", () => ({ log: jest.fn() }));

const terminologyRepository = require("../repositories/terminology.repository");
const customFieldRepository = require("../repositories/customField.repository");
const auditService = require("./audit.service");
const service = require("./settings.service");

const CTX = {
  companyId: 2, userId: 10, ip: "10.0.0.1", userAgent: "jest",
};

function fieldRow(overrides = {}) {
  return {
    id: 5,
    company_id: 2,
    entity_type: "ACCOUNT",
    field_key: "speciality",
    label: "Speciality",
    data_type: "SELECT",
    is_required: true,
    options_json: ["Cardio", "Neuro"],
    sort_order: 1,
    is_active: true,
    ...overrides,
  };
}

const TEXT_ROW = { data_type: "TEXT", options_json: null };

function uniqueViolation() {
  return Object.assign(new Error("duplicate"), { code: "23505" });
}

describe("settings.service terminology", () => {
  it("fills missing labels with the generic defaults", async () => {
    // Arrange
    terminologyRepository.listByCompany.mockResolvedValue([
      { term_key: "account.singular", label: "Doctor" },
      { term_key: "legacy.key", label: "Ignored" },
    ]);

    // Act
    const labels = await service.getTerminology(2);

    // Assert
    expect(labels).toEqual({
      "account.singular": "Doctor",
      "account.plural": "Accounts",
      "activity.singular": "Activity",
      "activity.plural": "Activities",
      "submission.singular": "Submission",
      "submission.plural": "Submissions",
      "rep.singular": "Rep",
      "rep.plural": "Reps",
    });
  });

  it("upserts labels, returns the merged map and audits before/after", async () => {
    // Arrange
    terminologyRepository.listByCompany.mockResolvedValue([]);
    const changes = { "account.plural": "Doctors" };

    // Act
    const labels = await service.updateTerminology(CTX, changes);

    // Assert
    expect(terminologyRepository.upsertLabels).toHaveBeenCalledWith(2, changes, 10);
    expect(labels["account.plural"]).toBe("Doctors");
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "TERMINOLOGY_UPDATED",
      entityType: "CompanyTerminology",
      entityId: 2,
      companyId: 2,
      performedBy: 10,
      ipAddress: "10.0.0.1",
      userAgent: "jest",
      oldValue: expect.objectContaining({ "account.plural": "Accounts" }),
      newValue: expect.objectContaining({ "account.plural": "Doctors" }),
    }));
  });
});

describe("settings.service custom fields", () => {
  it("lists fields as DTOs", async () => {
    // Arrange
    customFieldRepository.list.mockResolvedValue([fieldRow(), fieldRow({ id: 6, ...TEXT_ROW })]);
    const filters = { entityType: "ACCOUNT", includeInactive: true };

    // Act
    const fields = await service.listCustomFields(2, filters);

    // Assert
    expect(customFieldRepository.list).toHaveBeenCalledWith(2, filters);
    expect(fields).toEqual([
      {
        id: 5,
        entityType: "ACCOUNT",
        fieldKey: "speciality",
        label: "Speciality",
        dataType: "SELECT",
        isRequired: true,
        options: ["Cardio", "Neuro"],
        sortOrder: 1,
        isActive: true,
      },
      expect.objectContaining({ id: 6, options: null }),
    ]);
  });

  it("creates a field and audits it", async () => {
    // Arrange
    customFieldRepository.insert.mockResolvedValue(fieldRow());
    const field = { entityType: "ACCOUNT", fieldKey: "speciality", label: "Speciality" };

    // Act
    const dto = await service.createCustomField(CTX, field);

    // Assert
    expect(customFieldRepository.insert).toHaveBeenCalledWith(2, field, 10);
    expect(dto.id).toBe(5);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "CUSTOM_FIELD_CREATED", entityId: 5, oldValue: null,
    }));
  });

  it("turns a duplicate key into 409 CONFLICT", async () => {
    // Arrange
    customFieldRepository.insert.mockRejectedValue(uniqueViolation());

    // Act
    const promise = service.createCustomField(CTX, { fieldKey: "speciality" });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("rethrows other insert errors", async () => {
    // Arrange
    customFieldRepository.insert.mockRejectedValue(new Error("db down"));

    // Act
    const promise = service.createCustomField(CTX, { fieldKey: "x" });

    // Assert
    await expect(promise).rejects.toThrow("db down");
  });

  it("merges a partial update onto the stored field", async () => {
    // Arrange
    customFieldRepository.findById.mockResolvedValue(fieldRow());
    customFieldRepository.update.mockResolvedValue(fieldRow({ label: "Specialty" }));
    const changes = { label: "Specialty", fieldKey: "speciality" };

    // Act
    const dto = await service.updateCustomField(CTX, 5, changes);

    // Assert
    expect(customFieldRepository.update).toHaveBeenCalledWith(2, 5, {
      label: "Specialty",
      isRequired: true,
      options: ["Cardio", "Neuro"],
      sortOrder: 1,
      isActive: true,
    }, 10);
    expect(dto.label).toBe("Specialty");
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "CUSTOM_FIELD_UPDATED",
      oldValue: expect.objectContaining({ label: "Speciality" }),
    }));
  });

  it("drops options on a non-select field", async () => {
    // Arrange
    customFieldRepository.findById.mockResolvedValue(fieldRow(TEXT_ROW));
    customFieldRepository.update.mockResolvedValue(fieldRow(TEXT_ROW));

    // Act
    await service.updateCustomField(CTX, 5, { options: ["A"], isActive: false });

    // Assert
    expect(customFieldRepository.update).toHaveBeenCalledWith(
      2,
      5,
      expect.objectContaining({ options: null, isActive: false }),
      10,
    );
  });

  it.each([
    [{ fieldKey: "other" }, /fieldKey/],
    [{ dataType: "TEXT", entityType: "SUBMISSION" }, /entityType, dataType/],
    [{ options: null }, /Options are required/],
  ])("rejects update %p with 400", async (changes, message) => {
    // Arrange
    customFieldRepository.findById.mockResolvedValue(fieldRow());

    // Act
    const promise = service.updateCustomField(CTX, 5, changes);

    // Assert
    await expect(promise).rejects.toMatchObject({
      status: 400, errorCode: "VALIDATION_FAILED", message: expect.stringMatching(message),
    });
    expect(customFieldRepository.update).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, null],
    ["vanished", fieldRow(), null],
  ])("returns 404 when the field is %s on update", async (_label, found, updated) => {
    // Arrange
    customFieldRepository.findById.mockResolvedValue(found);
    customFieldRepository.update.mockResolvedValue(updated);

    // Act
    const promise = service.updateCustomField(CTX, 5, { label: "x" });

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
  });

  it("soft deletes a field and audits the old value", async () => {
    // Arrange
    customFieldRepository.findById.mockResolvedValue(fieldRow());
    customFieldRepository.softDelete.mockResolvedValue(true);

    // Act
    await service.deleteCustomField(CTX, 5);

    // Assert
    expect(customFieldRepository.softDelete).toHaveBeenCalledWith(2, 5, 10);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "CUSTOM_FIELD_DELETED", entityId: 5, newValue: null,
    }));
  });

  it.each([
    ["missing", null, false],
    ["already deleted", fieldRow(), false],
  ])("returns 404 when deleting a %s field", async (_label, found, deleted) => {
    // Arrange
    customFieldRepository.findById.mockResolvedValue(found);
    customFieldRepository.softDelete.mockResolvedValue(deleted);

    // Act
    const promise = service.deleteCustomField(CTX, 5);

    // Assert
    await expect(promise).rejects.toMatchObject({ status: 404 });
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
