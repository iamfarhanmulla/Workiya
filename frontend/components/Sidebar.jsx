"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { label: "Dashboard",  href: "/dashboard",            icon: "dashboard" },
  { label: "Companies",  href: "/dashboard/companies",  icon: "apartment" },
  { label: "Employees",  href: "/dashboard/employees",  icon: "group" },
  { label: "Tasks",      href: "/dashboard/tasks",      icon: "task_alt" },
  { label: "Attendance", href: "/dashboard/attendance", icon: "schedule" },
  { label: "Leaves",     href: "/dashboard/leaves",     icon: "event_available" },
  { label: "Reports",    href: "/dashboard/reports",    icon: "bar_chart" },
  { label: "Settings",   href: "/dashboard/settings",   icon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
        </div>
        <span className="sidebar-logo-name">WorKiya</span>
      </div>

      <nav className="sidebar-nav">
        {nav.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className={`sidebar-link${active ? " active" : ""}`}>
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-avatar">MC</div>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name">Marcus Chen</span>
          <span className="sidebar-user-role">Operations Director</span>
        </div>
      </div>
    </aside>
  );
}
