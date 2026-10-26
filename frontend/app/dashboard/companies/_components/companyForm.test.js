import {
  ALL_FILTERS, EMPTY_FORM, companyCounts, companyLocation, filterCompanies, formProblem,
  planLabel, statusBody, toForm, userCount,
} from "./companyForm";

const COMPANIES = [
  {
    Id: 1,
    Name: "Sunrise Pharma",
    Key: "sunrise-pharma",
    City: "Pune",
    Country: "India",
    Plan: "ENTERPRISE",
    IsActive: true,
    TotalUsers: 12,
    EmployeeCount: 9,
    ManagerCount: 2,
  },
  {
    Id: 2,
    Name: "Blue Labs",
    City: "Berlin",
    Country: "Germany",
    Plan: "STARTUP",
    IsActive: false,
    EmployeeCount: 3,
    ManagerCount: 1,
  },
  {
    Id: 3,
    Name: "Coastal Retail",
    Country: "India",
    Plan: "PROFESSIONAL",
    IsActive: 1,
    TotalUsers: 0,
  },
];

describe("formProblem", () => {
  it.each([
    [{ ...EMPTY_FORM }, "Company name is required."],
    [{ ...EMPTY_FORM, name: "Acme" }, ""],
  ])("requires a company name (%#)", (form, expected) => {
    // Arrange / Act / Assert
    expect(formProblem(form)).toBe(expected);
  });
});

describe("toForm", () => {
  it("maps an API row to form values, defaulting the plan and blanks", () => {
    // Arrange / Act
    const form = toForm({ ...COMPANIES[1], Plan: null });

    // Assert
    expect(form).toEqual({
      ...EMPTY_FORM, name: "Blue Labs", city: "Berlin", country: "Germany", isActive: 0,
    });
  });
});

describe("statusBody", () => {
  it("flips the active flag", () => {
    // Arrange / Act / Assert
    expect(statusBody(COMPANIES[0])).toEqual({ isActive: 0 });
    expect(statusBody(COMPANIES[1])).toEqual({ isActive: 1 });
  });
});

describe("display helpers", () => {
  it("formats location, plan label and user count", () => {
    // Arrange / Act / Assert
    expect(companyLocation(COMPANIES[0])).toBe("Pune, India");
    expect(companyLocation(COMPANIES[2])).toBe("India");
    expect(planLabel("PROFESSIONAL")).toBe("Professional");
    expect(planLabel(null)).toBe("");
    expect(userCount(COMPANIES[0])).toBe(12);
    expect(userCount(COMPANIES[1])).toBe(4);
    expect(userCount(COMPANIES[2])).toBe(0);
  });
});

describe("filterCompanies", () => {
  it.each([
    [{ ...ALL_FILTERS, search: "BERLIN" }, [2]],
    [{ ...ALL_FILTERS, search: "india" }, [1, 3]],
    [{ ...ALL_FILTERS, plan: "STARTUP" }, [2]],
    [{ ...ALL_FILTERS, status: "Active" }, [1, 3]],
    [{ ...ALL_FILTERS, status: "Inactive" }, [2]],
    [{ ...ALL_FILTERS, plan: "ENTERPRISE", status: "Inactive" }, []],
  ])("filters by search, plan and status (%#)", (filters, ids) => {
    // Arrange / Act
    const result = filterCompanies(COMPANIES, filters);

    // Assert
    expect(result.map((c) => c.Id)).toEqual(ids);
  });
});

describe("companyCounts", () => {
  it("counts status, plans and users", () => {
    // Arrange / Act
    const counts = companyCounts(COMPANIES);

    // Assert
    expect(counts).toEqual({
      total: 3,
      active: 2,
      inactive: 1,
      startup: 1,
      professional: 1,
      enterprise: 1,
      users: 16,
      employees: 12,
      managers: 3,
    });
  });
});
