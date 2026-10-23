import {
  EMPTY_FORM, employeeCounts, employeeName, filterEmployees, formProblem, managerLabel,
  statusChange, taskProgress, toBody, toForm,
} from "./employeeForm";

const EMPLOYEES = [
  {
    Id: 1,
    FirstName: "Asha",
    LastName: "Rao",
    Email: "asha@x.in",
    CompanyId: 5,
    TaskCount: 4,
    TaskDone: 4,
    IsActive: true,
  },
  {
    Id: 2,
    FirstName: "Ravi",
    LastName: "Kumar",
    Email: "ravi@x.in",
    CompanyId: 5,
    ManagerId: 9,
    TaskCount: 3,
    TaskDone: 1,
    IsActive: false,
  },
  {
    Id: 3,
    DisplayName: "Meena",
    Email: "meena@y.in",
    CompanyId: 6,
    IsActive: true,
  },
];

const ALL = { search: "", company: "All", status: "All" };

describe("formProblem", () => {
  it.each([
    [{ ...EMPTY_FORM }, false, "Email is required."],
    [{ ...EMPTY_FORM, email: "a@b.in" }, false, "Password is required for new employee."],
    [{ ...EMPTY_FORM, email: "a@b.in", password: "x" }, false, ""],
    [{ ...EMPTY_FORM, email: "a@b.in" }, true, ""],
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
    expect(toBody({ ...form, password: "new" }, true)).toHaveProperty("password", "new");
  });
});

describe("toForm", () => {
  it("maps an API row to form values with an empty password", () => {
    // Arrange / Act
    const form = toForm(EMPLOYEES[1]);

    // Assert
    expect(form).toMatchObject({
      firstName: "Ravi", email: "ravi@x.in", password: "", managerId: 9, isActive: 0,
    });
  });
});

describe("filterEmployees", () => {
  it.each([
    [{ ...ALL, search: "KUMAR" }, [2]],
    [{ ...ALL, search: "meena" }, [3]],
    [{ ...ALL, company: "5" }, [1, 2]],
    [{ ...ALL, status: "Active" }, [1, 3]],
    [{ ...ALL, status: "Inactive", company: "5" }, [2]],
  ])("filters by search, company and status (%#)", (filters, ids) => {
    // Arrange / Act
    const result = filterEmployees(EMPLOYEES, filters);

    // Assert
    expect(result.map((e) => e.Id)).toEqual(ids);
  });
});

describe("display helpers", () => {
  it("names, counts and measures task progress", () => {
    // Arrange / Act
    const counts = employeeCounts(EMPLOYEES);

    // Assert
    expect(counts).toEqual({
      total: 3, active: 2, inactive: 1, tasks: 7,
    });
    expect(employeeName(EMPLOYEES[0])).toBe("Asha Rao");
    expect(employeeName(EMPLOYEES[2])).toBe("Meena");
    expect(employeeName({})).toBe("—");
    expect(taskProgress(EMPLOYEES[1])).toEqual({ done: 1, total: 3, pct: 33 });
    expect(taskProgress(EMPLOYEES[2])).toEqual({ done: 0, total: 0, pct: 0 });
  });

  it("labels managers with their company when known", () => {
    // Arrange / Act / Assert
    expect(managerLabel({ Name: "Meena", CompanyName: "Moonlight" })).toBe("Meena (Moonlight)");
    expect(managerLabel({ Name: "Meena" })).toBe("Meena");
  });
});

describe("statusChange", () => {
  it("flips the active flag and picks the matching toast", () => {
    // Arrange / Act
    const deactivate = statusChange(EMPLOYEES[0]);
    const activate = statusChange(EMPLOYEES[1]);

    // Assert
    expect(deactivate).toEqual({
      body: { isActive: 0 }, message: "Employee deactivated.", type: "warning",
    });
    expect(activate).toEqual({
      body: { isActive: 1 }, message: "Employee activated.", type: "success",
    });
  });
});
