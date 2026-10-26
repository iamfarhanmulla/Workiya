// Managers page rules ("_components" is private: no route). Rows come from the API in
// PascalCase (Id, FirstName, EmployeeCount…); the form and request body use camelCase.

export const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  phoneNumber: "",
  displayName: "",
  companyId: "",
  password: "",
  isActive: 1,
};

export const ALL_FILTERS = { search: "", company: "All", status: "All" };

export function managerName(m) {
  return `${m.FirstName || ""} ${m.LastName || ""}`.trim() || m.DisplayName || m.Email || "—";
}

export function toForm(m) {
  return {
    firstName: m.FirstName || "",
    lastName: m.LastName || "",
    middleName: m.MiddleName || "",
    email: m.Email || "",
    phoneNumber: m.PhoneNumber || "",
    displayName: m.DisplayName || "",
    companyId: m.CompanyId || "",
    password: "",
    isActive: m.IsActive ? 1 : 0,
  };
}

// The first reason the form cannot be saved, or "".
export function formProblem(form, isEdit) {
  if (!form.email) return "Email is required.";
  if (!isEdit && !form.password) return "Password is required for new manager.";
  return "";
}

// An empty password on edit means "keep the current one", so it is not sent.
export function toBody(form, isEdit) {
  const body = { ...form };
  if (isEdit && !body.password) delete body.password;
  return body;
}

export function filterManagers(managers, filters) {
  const term = filters.search.toLowerCase();
  return managers.filter((m) => {
    const matches = managerName(m).toLowerCase().includes(term)
      || (m.Email || "").toLowerCase().includes(term);
    const status = filters.status === "All"
      || (filters.status === "Active" ? m.IsActive : !m.IsActive);
    return matches && status
      && (filters.company === "All" || String(m.CompanyId) === filters.company);
  });
}

export function managerCounts(managers) {
  return {
    total: managers.length,
    active: managers.filter((m) => m.IsActive).length,
    inactive: managers.filter((m) => !m.IsActive).length,
    employees: managers.reduce((sum, m) => sum + (m.EmployeeCount || 0), 0),
  };
}
