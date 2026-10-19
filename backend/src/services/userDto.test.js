const { toUserDto } = require("./userDto");
const { userRow } = require("../../test/helpers/authFixtures");

describe("toUserDto", () => {
  it("maps a user row to the public UserDto without credential fields", () => {
    // Arrange
    const row = userRow();

    // Act
    const dto = toUserDto(row);

    // Assert
    expect(dto).toEqual({
      id: 11,
      companyId: 2,
      roleId: 4,
      roleCode: "MANAGER",
      roleName: "Manager",
      username: "mgr",
      email: "mgr@example.com",
      displayName: "Mgr",
      firstName: "M",
      middleName: null,
      lastName: "G",
      phoneNumber: null,
      status: 1
    });
  });

  it("returns null role fields when the row has no role join", () => {
    // Arrange
    const row = userRow({ RoleCode: undefined, RoleName: "" });

    // Act
    const dto = toUserDto(row);

    // Assert
    expect(dto.roleCode).toBeNull();
    expect(dto.roleName).toBeNull();
  });
});
