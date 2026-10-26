const { toAccountDto, toAssignmentDto, toExtraFields } = require("./account.dto");

describe("account.dto", () => {
  it("maps a snake_case row to camelCase with numbers and ISO dates", () => {
    // Arrange
    const row = {
      id: 4,
      company_id: 2,
      name: "City Clinic",
      latitude: 18.52,
      longitude: null,
      extra_fields: { tier: "A" },
      is_active: true,
      created_at: new Date("2026-10-21T10:00:00Z"),
      updated_at: null,
    };

    // Act
    const dto = toAccountDto(row, [{ user_id: 30, display_name: "Rep", visits_per_month: 3 }]);

    // Assert
    expect(dto).toEqual({
      id: 4,
      companyId: 2,
      name: "City Clinic",
      phoneNumber: null,
      email: null,
      address: null,
      city: null,
      state: null,
      country: null,
      latitude: 18.52,
      longitude: null,
      photoUrl: null,
      notes: null,
      extraFields: { tier: "A" },
      isActive: true,
      createdAtUtc: "2026-10-21T10:00:00.000Z",
      updatedAtUtc: null,
      assignedUsers: [{ userId: 30, displayName: "Rep", visitsPerMonth: 3 }],
    });
  });

  it.each([
    [null, {}],
    [[1, 2], {}],
    ["text", {}],
    [{ a: 1 }, { a: 1 }],
  ])("reads extra fields %p as an object", (value, expected) => {
    // Arrange / Act
    const result = toExtraFields(value);

    // Assert
    expect(result).toEqual(expected);
  });

  it("maps an assignment row with its role", () => {
    // Arrange
    const row = {
      user_id: 30, display_name: "Rep", visits_per_month: null, role_code: null,
    };

    // Act
    const dto = toAssignmentDto(row);

    // Assert
    expect(dto).toEqual({
      userId: 30, displayName: "Rep", visitsPerMonth: null, roleCode: null,
    });
  });
});
