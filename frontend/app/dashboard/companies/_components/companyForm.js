// Companies page rules ("_components" is private: no route). Rows come from the API in
// PascalCase (Id, Name, Plan…); the form and request body use camelCase.

export const PLANS = ["STARTUP", "PROFESSIONAL", "ENTERPRISE"];

export const PLAN_LABELS = {
  STARTUP: "Startup",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

export const PLAN_OPTIONS = PLANS.map((p) => ({ value: p, label: PLAN_LABELS[p] }));

export const STATUS_FILTER_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

export const EMPTY_FORM = {
  name: "",
  key: "",
  contactEmail: "",
  contactPhone: "",
  address: "",
  city: "",
  country: "",
  plan: "STARTUP",
  isActive: 1,
};

export const ALL_FILTERS = { search: "", plan: "All", status: "All" };

export function toForm(company) {
  return {
    name: company.Name || "",
    key: company.Key || "",
    contactEmail: company.ContactEmail || "",
    contactPhone: company.ContactPhone || "",
    address: company.Address || "",
    city: company.City || "",
    country: company.Country || "",
    plan: company.Plan || "STARTUP",
    isActive: company.IsActive ? 1 : 0,
  };
}

// The first reason the form cannot be saved, or "".
export function formProblem(form) {
  if (!form.name) return "Company name is required.";
  return "";
}

// PATCH /companies/:id/status body: flips the current state.
export function statusBody(company) {
  return { isActive: company.IsActive ? 0 : 1 };
}

// "Pune, India", "Pune", "India" or "".
export function companyLocation(company) {
  return [company.City, company.Country].filter(Boolean).join(", ");
}

export function planLabel(plan) {
  return PLAN_LABELS[plan] || plan || "";
}

// Older rows may lack TotalUsers; fall back to managers + employees.
export function userCount(company) {
  if (company.TotalUsers != null) return company.TotalUsers;
  return (company.EmployeeCount || 0) + (company.ManagerCount || 0);
}

export function filterCompanies(companies, filters) {
  const term = filters.search.toLowerCase();
  return companies.filter((c) => {
    const text = `${c.Name || ""} ${c.City || ""} ${c.Country || ""}`.toLowerCase();
    const statusOk = filters.status === "All"
      || (filters.status === "Active" ? Boolean(c.IsActive) : !c.IsActive);
    return text.includes(term)
      && (filters.plan === "All" || c.Plan === filters.plan)
      && statusOk;
  });
}

export function companyCounts(companies) {
  const sum = (key) => companies.reduce((s, c) => s + (c[key] || 0), 0);
  const plan = (p) => companies.filter((c) => c.Plan === p).length;
  return {
    total: companies.length,
    active: companies.filter((c) => c.IsActive).length,
    inactive: companies.filter((c) => !c.IsActive).length,
    startup: plan("STARTUP"),
    professional: plan("PROFESSIONAL"),
    enterprise: plan("ENTERPRISE"),
    users: companies.reduce((s, c) => s + userCount(c), 0),
    employees: sum("EmployeeCount"),
    managers: sum("ManagerCount"),
  };
}
