import { getDisplayName, getInitials } from "./useCurrentUser";

describe("user display helpers", () => {
  it("builds initials from first and last name, then email", () => {
    // Arrange
    const named = { firstName: "asha", lastName: "rao" };
    const emailOnly = { email: "zed@example.com" };

    // Act
    const results = [getInitials(named), getInitials(emailOnly), getInitials(null)];

    // Assert
    expect(results).toEqual(["AR", "Z", "?"]);
  });

  it("prefers displayName, then full name, then email", () => {
    // Arrange
    const users = [
      { displayName: "Boss", firstName: "A" },
      { firstName: "Asha", lastName: "Rao" },
      { email: "zed@example.com" },
      null,
    ];

    // Act
    const names = users.map(getDisplayName);

    // Assert
    expect(names).toEqual(["Boss", "Asha Rao", "zed@example.com", ""]);
  });
});
