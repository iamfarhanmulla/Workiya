import {
  EMPTY_FORM, filterManagers, formProblem, managerCounts, managerName, toBody,
} from "./managerForm";

const ALL = { search: "", company: "All", status: "All" };
const MANAGERS = [
  {
    Id: 1,
    FirstName: "Venkat",
    LastName: "S",
    Email: "v@x.in",
    CompanyId: 5,
    IsActive: true,
    EmployeeCount: 3,
  },
  {
    Id: 2, DisplayName: "Rekha N", Email: "rekha@y.in", CompanyId: 6, IsActive: false,
  },
];

describe("managerForm", () => {
  it("names a manager by full name, then display name, then email", () => {
    // Arrange / Act / Assert
    expect(managerName(MANAGERS[0])).toBe("Venkat S");
    expect(managerName(MANAGERS[1])).toBe("Rekha N");
    expect(managerName({ Email: "only@x.in" })).toBe("only@x.in");
  });

  it.each([
    [{ ...EMPTY_FORM }, false, "Email is required."],
    [{ ...EMPTY_FORM, email: "a@b.in" }, false, "Password is required for new manager."],
    [{ ...EMPTY_FORM, email: "a@b.in" }, true, ""],
  ])("checks required fields (%#)", (form, isEdit, expected) => {
    // Arrange / Act / Assert
    expect(formProblem(form, isEdit)).toBe(expected);
  });

  it("drops a blank password on edit only", () => {
    // Arrange / Act / Assert
    expect(toBody(EMPTY_FORM, true)).not.toHaveProperty("password");
    expect(toBody(EMPTY_FORM, false)).toHaveProperty("password");
  });

  it.each([
    [{ ...ALL, search: "REKHA" }, [2]],
    [{ ...ALL, search: "x.in" }, [1]],
    [{ ...ALL, company: "5" }, [1]],
    [{ ...ALL, status: "Inactive" }, [2]],
  ])("filters by text, company and status (%#)", (filters, ids) => {
    // Arrange / Act / Assert
    expect(filterManagers(MANAGERS, filters).map((m) => m.Id)).toEqual(ids);
  });

  it("counts active, inactive and the employees they lead", () => {
    // Arrange / Act / Assert
    expect(managerCounts(MANAGERS)).toEqual({
      total: 2, active: 1, inactive: 1, employees: 3,
    });
  });
});
