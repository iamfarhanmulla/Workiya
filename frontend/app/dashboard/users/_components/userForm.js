// Users page rules ("_components" is private: no route). Rows come from the API in
// PascalCase (Id, FirstName, RoleName…); the form and request body use camelCase.

export const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  username: "",
  password: "",
  phoneNumber: "",
  displayName: "",
  roleId: "",
  companyId: "",
  managerId: "",
  isActive: 1,
};

export const ALL_FILTERS = {
  search: "", role: "All", company: "All", manager: "All",
};

export function toForm(user) {
  return {
    firstName: user.FirstName || "",
    lastName: user.LastName || "",
    middleName: user.MiddleName || "",
    email: user.Email || "",
    username: user.Username || "",
    password: "",
    phoneNumber: user.PhoneNumber || "",
    displayName: user.DisplayName || "",
    roleId: user.RoleId || "",
    companyId: user.CompanyId || "",
    managerId: user.ManagerId || "",
    isActive: user.IsActive ? 1 : 0,
  };
}

// The first reason the form cannot be saved, or "".
export function formProblem(form, isEdit) {
  if (!form.email) return "Email is required.";
  if (!form.roleId) return "Role is required.";
  if (!isEdit && !form.password) return "Password is required.";
  return "";
}

// An empty password on edit means "keep the current one", so it is not sent.
export function toBody(form, isEdit) {
  const body = { ...form };
  if (isEdit && !body.password) delete body.password;
  return body;
}

export function filterUsers(users, filters) {
  const term = filters.search.toLowerCase();
  return users.filter((u) => {
    const text = `${u.FirstName || ""} ${u.LastName || ""} ${u.Email || ""}`.toLowerCase();
    return text.includes(term)
      && (filters.role === "All" || u.RoleName === filters.role)
      && (filters.company === "All" || String(u.CompanyId) === filters.company)
      && (filters.manager === "All" || String(u.ManagerId) === filters.manager);
  });
}

// One option per manager that at least one listed user reports to.
export function managerOptions(users) {
  const seen = new Map();
  users.forEach((u) => {
    if (u.ManagerId && !seen.has(u.ManagerId)) {
      seen.set(u.ManagerId, { value: String(u.ManagerId), label: u.ManagerName?.trim() || "" });
    }
  });
  return [...seen.values()];
}

export function userCounts(users) {
  return {
    total: users.length,
    active: users.filter((u) => u.IsActive).length,
    managers: users.filter((u) => u.RoleName === "Manager").length,
    employees: users.filter((u) => u.RoleName === "Employee").length,
  };
}
