import {
  buildNav, isActive, isGroupActive,
} from "./navConfig";

const t = (key) => `T:${key}`;
const labels = (entries) => entries.map((e) => e.label);

describe("buildNav", () => {
  it("gives a SUPER_ADMIN companies, people and reports", () => {
    // Arrange / Act
    const nav = buildNav(t, "SUPER_ADMIN");

    // Assert
    expect(labels(nav)).toEqual([
      "Dashboard", "Companies", "People", "T:account.plural", "T:activity.plural",
      "Attendance", "Reports",
    ]);
    expect(nav.find((e) => e.label === "People").items.map((i) => i.href)).toEqual([
      "/dashboard/users", "/dashboard/managers", "/dashboard/employees",
    ]);
  });

  it("gives an ADMIN everything except companies", () => {
    // Arrange / Act
    const nav = buildNav(t, "ADMIN");

    // Assert
    expect(labels(nav)).not.toContain("Companies");
    expect(labels(nav)).toContain("People");
  });

  it("gives a MANAGER a Team link to employees instead of the People menu", () => {
    // Arrange / Act
    const nav = buildNav(t, "MANAGER");

    // Assert
    expect(nav.find((e) => e.label === "Team"))
      .toEqual({ label: "Team", href: "/dashboard/employees" });
    expect(labels(nav)).not.toContain("People");
    expect(labels(nav)).toContain("Reports");
  });

  it("gives an EMPLOYEE no people or reports links", () => {
    // Arrange / Act
    const nav = buildNav(t, "EMPLOYEE");

    // Assert
    expect(labels(nav))
      .toEqual(["Dashboard", "T:account.plural", "T:activity.plural", "Attendance"]);
  });

  it("shows only the dashboard while the role is unknown", () => {
    // Arrange / Act
    const nav = buildNav(t, undefined);

    // Assert
    expect(nav).toEqual([{ label: "Dashboard", href: "/dashboard" }]);
  });
});

describe("isActive", () => {
  it.each([
    ["/dashboard", "/dashboard", true],
    ["/dashboard/accounts", "/dashboard", false],
    ["/dashboard/accounts/12", "/dashboard/accounts", true],
    ["/dashboard/accountsx", "/dashboard/accounts", false],
  ])("path %s with link %s is %s", (pathname, href, expected) => {
    // Arrange / Act / Assert
    expect(isActive(pathname, href)).toBe(expected);
  });

  it("marks a group active when one of its links is", () => {
    // Arrange
    const group = buildNav(t, "ADMIN").find((e) => e.label === "Attendance");

    // Act / Assert
    expect(isGroupActive("/dashboard/leaves", group)).toBe(true);
    expect(isGroupActive("/dashboard/reports", group)).toBe(false);
  });
});
