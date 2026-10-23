// Employees page rules ("_components" is private: no route). Rows come from the API in
// PascalCase (Id, FirstName, TaskCount…); the form and request body use camelCase.

export const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  phoneNumber: "",
  displayName: "",
  companyId: "",
  managerId: "",
  password: "",
  isActive: 1,
};

export const ALL_FILTERS = { search: "", company: "All", status: "All" };

export function toForm(employee) {
  return {
    firstName: employee.FirstName || "",
    lastName: employee.LastName || "",
    middleName: employee.MiddleName || "",
    email: employee.Email || "",
    phoneNumber: employee.PhoneNumber || "",
    displayName: employee.DisplayName || "",
    companyId: employee.CompanyId || "",
    managerId: employee.ManagerId || "",
    password: "",
    isActive: employee.IsActive ? 1 : 0,
  };
}

// The first reason the form cannot be saved, or "".
export function formProblem(form, isEdit) {
  if (!form.email) return "Email is required.";
  if (!isEdit && !form.password) return "Password is required for new employee.";
  return "";
}

// An empty password on edit means "keep the current one", so it is not sent.
export function toBody(form, isEdit) {
  const body = { ...form };
  if (isEdit && !body.password) delete body.password;
  return body;
}

// First + last name, else the display name, else the email.
export function employeeName(e) {
  return `${e.FirstName || ""} ${e.LastName || ""}`.trim() || e.DisplayName || e.Email || "—";
}

export function filterEmployees(employees, filters) {
  const term = filters.search.toLowerCase();
  return employees.filter((e) => {
    const text = `${employeeName(e)} ${e.Email || ""}`.toLowerCase();
    const status = filters.status === "Active" ? e.IsActive : !e.IsActive;
    return text.includes(term)
      && (filters.company === "All" || String(e.CompanyId) === filters.company)
      && (filters.status === "All" || status);
  });
}

export function employeeCounts(employees) {
  return {
    total: employees.length,
    active: employees.filter((e) => e.IsActive).length,
    inactive: employees.filter((e) => !e.IsActive).length,
    tasks: employees.reduce((sum, e) => sum + (e.TaskCount || 0), 0),
  };
}

export function taskProgress(e) {
  const done = e.TaskDone || 0;
  const total = e.TaskCount || 0;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function managerLabel(m) {
  return m.CompanyName ? `${m.Name} (${m.CompanyName})` : m.Name;
}

// Request body and toast for the row's Activate / Deactivate button.
export function statusChange(e) {
  return e.IsActive
    ? { body: { isActive: 0 }, message: "Employee deactivated.", type: "warning" }
    : { body: { isActive: 1 }, message: "Employee activated.", type: "success" };
}
