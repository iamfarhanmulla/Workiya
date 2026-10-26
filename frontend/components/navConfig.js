// Top navigation per role. An entry is a link { label, href } or a group
// { label, items } shown as a dropdown. Hiding a link is only a convenience;
// the API still enforces what each role may read or change.

export const SETTINGS_ROLES = ["SUPER_ADMIN", "ADMIN"];
export const ACTIVITY_CREATORS = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

export const SETTINGS_LINKS = [
  { label: "Settings", href: "/dashboard/settings", icon: "tune" },
  { label: "Billing & plan", href: "/dashboard/billing", icon: "credit_card" },
];

const PEOPLE = {
  label: "People",
  items: [
    { label: "Users", href: "/dashboard/users" },
    { label: "Managers", href: "/dashboard/managers" },
    { label: "Employees", href: "/dashboard/employees" },
  ],
};

const ATTENDANCE = {
  label: "Attendance",
  items: [
    { label: "Attendance", href: "/dashboard/attendance" },
    { label: "Leaves", href: "/dashboard/leaves" },
  ],
};

export function buildNav(t, roleCode) {
  const dashboard = { label: "Dashboard", href: "/dashboard" };
  const accounts = { label: t("account.plural"), href: "/dashboard/accounts" };
  const activities = { label: t("activity.plural"), href: "/dashboard/activities" };
  const reports = { label: "Reports", href: "/dashboard/reports" };

  switch (roleCode) {
    case "SUPER_ADMIN":
      return [dashboard, { label: "Companies", href: "/dashboard/companies" },
        PEOPLE, accounts, activities, ATTENDANCE, reports];
    case "ADMIN":
      return [dashboard, PEOPLE, accounts, activities, ATTENDANCE, reports];
    case "MANAGER":
      return [dashboard, { label: "Team", href: "/dashboard/employees" },
        accounts, activities, ATTENDANCE, reports];
    case "EMPLOYEE":
      return [dashboard, accounts, activities, ATTENDANCE];
    default:
      // The user is still loading: show nothing that a role might not be allowed.
      return [dashboard];
  }
}

export function isActive(pathname, href) {
  if (pathname === href) return true;
  return href !== "/dashboard" && pathname.startsWith(`${href}/`);
}

export function isGroupActive(pathname, group) {
  return group.items.some((item) => isActive(pathname, item.href));
}
