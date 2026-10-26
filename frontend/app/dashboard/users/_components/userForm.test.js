import {
  EMPTY_FORM, filterUsers, formProblem, managerOptions, toBody, toForm, userCounts,
} from "./userForm";

const USERS = [
  {
    Id: 1,
    FirstName: "Asha",
    LastName: "Rao",
    Email: "asha@x.in",
    RoleName: "Manager",
    CompanyId: 5,
    IsActive: true,
  },
  {
    Id: 2,
    FirstName: "Ravi",
    LastName: "Kumar",
    Email: "ravi@x.in",
    RoleName: "Employee",
    CompanyId: 5,
    ManagerId: 1,
    ManagerName: " Asha Rao ",
    IsActive: false,
  },
  {
    Id: 3,
    FirstName: "Meena",
    LastName: "Iyer",
    Email: "meena@y.in",
    RoleName: "Employee",
    CompanyId: 6,
    ManagerId: 1,
    ManagerName: "Asha Rao",
    IsActive: true,
  },
];

const ALL = {
  search: "", role: "All", company: "All", manager: "All",
};

describe("formProblem", () => {
  it.each([
    [{ ...EMPTY_FORM }, false, "Email is required."],
    [{ ...EMPTY_FORM, email: "a@b.in" }, false, "Role is required."],
    [{ ...EMPTY_FORM, email: "a@b.in", roleId: 2 }, false, "Password is required."],
    [{ ...EMPTY_FORM, email: "a@b.in", roleId: 2 }, true, ""],
  ])("reports the first missing field (%#)", (form, isEdit, expected) => {
    // Arrange / Act / Assert
    expect(formProblem(form, isEdit)).toBe(expected);
  });
});

describe("toBody", () => {
  it("leaves out an empty password when editing, keeps it when adding", () => {
    // Arrange
    const form = { ...EMPTY_FORM, email: "a@b.in" };

    // Act / Assert
    expect(toBody(form, true)).not.toHaveProperty("password");
    expect(toBody(form, false)).toHaveProperty("password", "");
  });
});

describe("toForm", () => {
  it("maps an API row to form values with an empty password", () => {
    // Arrange / Act
    const form = toForm(USERS[1]);

    // Assert
    expect(form).toMatchObject({
      firstName: "Ravi", email: "ravi@x.in", password: "", managerId: 1, isActive: 0,
    });
  });
});

describe("filterUsers", () => {
  it.each([
    [{ ...ALL, search: "KUMAR" }, [2]],
    [{ ...ALL, role: "Employee" }, [2, 3]],
    [{ ...ALL, company: "6" }, [3]],
    [{ ...ALL, manager: "1", company: "5" }, [2]],
  ])("filters by search, role, company and manager (%#)", (filters, ids) => {
    // Arrange / Act
    const result = filterUsers(USERS, filters);

    // Assert
    expect(result.map((u) => u.Id)).toEqual(ids);
  });
});

describe("managerOptions and userCounts", () => {
  it("lists each manager once and counts roles and active users", () => {
    // Arrange / Act
    const options = managerOptions(USERS);
    const counts = userCounts(USERS);

    // Assert
    expect(options).toEqual([{ value: "1", label: "Asha Rao" }]);
    expect(counts).toEqual({
      total: 3, active: 2, managers: 1, employees: 2,
    });
  });
});
