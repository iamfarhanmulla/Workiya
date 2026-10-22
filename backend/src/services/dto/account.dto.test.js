const { toAccountDto, toAssignmentDto, parseExtraFields } = require("./account.dto");

describe("account.dto", () => {
  it("maps a row to camelCase with parsed extra fields, numbers and ISO dates", () => {
    // Arrange
    const row = {
      Id: 4,
      CompanyId: 2,
      Name: "City Clinic",
      Latitude: "18.5200000",
      Longitude: null,
      ExtraFields: "{\"tier\":\"A\"}",
      IsActive: 1,
      CreatedAtUtc: new Date("2026-10-21T10:00:00Z"),
      UpdatedAtUtc: null,
    };

    // Act
    const dto = toAccountDto(row, [{ UserId: 30, DisplayName: "Rep", VisitsPerMonth: 3 }]);

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
    ["not json", {}],
    ["[1,2]", {}],
    ["\"text\"", {}],
    ["{\"a\":1}", { a: 1 }],
  ])("parses extra fields %p as an object", (text, expected) => {
    // Arrange / Act
    const result = parseExtraFields(text);

    // Assert
    expect(result).toEqual(expected);
  });

  it("maps an assignment row with its role", () => {
    // Arrange
    const row = {
      UserId: 30, DisplayName: "Rep", VisitsPerMonth: null, RoleCode: null,
    };

    // Act
    const dto = toAssignmentDto(row);

    // Assert
    expect(dto).toEqual({
      userId: 30, displayName: "Rep", visitsPerMonth: null, roleCode: null,
    });
  });
});
