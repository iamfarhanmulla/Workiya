"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTerminology } from "@/hooks/useTerminology";
import {
  EXPANDED_W, animateToggle, handleNavClick, onEnter, onLeave, revealSidebar,
} from "./sidebarAnimations";

export function buildSections(t) {
  return [
    {
      label: "Main",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
        { label: "Companies", href: "/dashboard/companies", icon: "apartment" },
        { label: "Users", href: "/dashboard/users", icon: "person" },
        { label: "Managers", href: "/dashboard/managers", icon: "manage_accounts" },
      ],
    },
    {
      label: "Field Ops",
      items: [
        { label: "Employees", href: "/dashboard/employees", icon: "group" },
        { label: t("account.plural"), href: "/dashboard/accounts", icon: "medical_services" },
        { label: t("activity.plural"), href: "/dashboard/activities", icon: "task_alt" },
      ],
    },
    {
      label: "Attendance",
      items: [
        { label: "Attendance", href: "/dashboard/attendance", icon: "schedule" },
        { label: "Leaves", href: "/dashboard/leaves", icon: "event_available" },
      ],
    },
    {
      label: "Analytics",
      items: [
        { label: "Reports", href: "/dashboard/reports", icon: "bar_chart" },
      ],
    },
  ];
}

const BOTTOM_LINKS = [
  { href: "/dashboard/settings", icon: "settings", label: "Settings" },
  { href: "/dashboard/billing", icon: "payments", label: "Billing" },
];

function NavLink({
  href, icon, label, active, iconStyle, collapsed,
}) {
  return (
    <Link
      href={href}
      className={`sidebar-link sb-item${active ? " active" : ""}`}
      onClick={handleNavClick}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <span className="sb-icon">
        <span className="material-symbols-outlined" style={iconStyle}>{icon}</span>
      </span>
      <span className="sb-label">{label}</span>
      {collapsed && <span className="sb-tooltip">{label}</span>}
    </Link>
  );
}

function isActive(pathname, href) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

function NavSections({ sections, pathname, collapsed }) {
  return (
    <nav className="sidebar-nav">
      {sections.map(({ label, items }) => (
        <div key={label}>
          <div className="sidebar-section-label sb-section-label">{label}</div>
          {items.map(({ label: lbl, href, icon }) => {
            const active = isActive(pathname, href);
            const iconStyle = {
              fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
              fontSize: 18,
            };
            return (
              <NavLink
                key={href}
                href={href}
                icon={icon}
                label={lbl}
                active={active}
                iconStyle={iconStyle}
                collapsed={collapsed}
              />
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarLogo() {
  return (
    <div className="sb-logo">
      <div className="dash-logo-mark sb-logo-mark">
        <span
          className="material-symbols-outlined"
          style={{ fontVariationSettings: "'FILL' 1", fontSize: 16 }}
        >
          work
        </span>
      </div>
      <div
        className="sb-logo-text sb-label"
        style={{ overflow: "hidden", whiteSpace: "nowrap" }}
      >
        <div className="dash-logo-name">WorKiya</div>
        <div className="dash-logo-sub">Super Admin Console</div>
      </div>
    </div>
  );
}

function SidebarBottom({ pathname, collapsed, planFillRef }) {
  return (
    <div className="sidebar-bottom">
      <div className="sb-plan sidebar-plan">
        <div className="sb-plan-text">
          <div className="sidebar-plan-label">System Plan</div>
          <div className="sidebar-plan-name">Enterprise Pro</div>
        </div>
        <div className="sidebar-plan-bar">
          <div ref={planFillRef} className="sidebar-plan-fill" style={{ width: 0 }} />
        </div>
      </div>

      {BOTTOM_LINKS.map(({ href, icon, label }) => (
        <NavLink
          key={href}
          href={href}
          icon={icon}
          label={label}
          active={pathname === href}
          iconStyle={{ fontSize: 18 }}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useTerminology();
  const wrapperRef = useRef(null);
  const sidebarRef = useRef(null);
  const toggleRef = useRef(null);
  const planFillRef = useRef(null);
  const colRef = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    revealSidebar(sidebarRef.current, toggleRef.current, planFillRef.current);
  }, []);

  function toggleCollapse() {
    colRef.current = !colRef.current;
    setCollapsed(colRef.current);
    animateToggle(colRef.current, sidebarRef.current, wrapperRef.current, toggleRef.current);
  }

  return (
    // Wrapper is position:relative so toggle can sit on its right edge
    <div ref={wrapperRef} className="sb-wrapper" style={{ width: EXPANDED_W }}>

      {/* Toggle — OUTSIDE sidebar so overflow:hidden never clips it */}
      <button
        type="button"
        ref={toggleRef}
        className="sb-toggle"
        onClick={toggleCollapse}
        aria-label="Toggle sidebar"
      >
        <span className="material-symbols-outlined sb-toggle-icon">chevron_left</span>
      </button>

      <aside ref={sidebarRef} className="sidebar" style={{ width: "100%", overflow: "hidden" }}>
        <SidebarLogo />
        <NavSections sections={buildSections(t)} pathname={pathname} collapsed={collapsed} />
        <SidebarBottom pathname={pathname} collapsed={collapsed} planFillRef={planFillRef} />
      </aside>
    </div>
  );
}
