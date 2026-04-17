"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const sections = [
  {
    label: "Main",
    items: [
      { label: "Dashboard",  href: "/dashboard",           icon: "dashboard" },
      { label: "Companies",  href: "/dashboard/companies",  icon: "apartment" },
      { label: "Users",      href: "/dashboard/users",      icon: "person" },
      { label: "Managers",   href: "/dashboard/managers",   icon: "manage_accounts" },
    ],
  },
  {
    label: "Field Ops",
    items: [
      { label: "Employees",  href: "/dashboard/employees",  icon: "group" },
      { label: "Doctors",    href: "/dashboard/doctors",    icon: "medical_services" },
      { label: "Tasks",      href: "/dashboard/tasks",      icon: "task_alt" },
    ],
  },
  {
    label: "Attendance",
    items: [
      { label: "Attendance", href: "/dashboard/attendance", icon: "schedule" },
      { label: "Leaves",     href: "/dashboard/leaves",     icon: "event_available" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { label: "Reports",    href: "/dashboard/reports",    icon: "bar_chart" },
    ],
  },
];

const EXPANDED_W = 220;
const COLLAPSED_W = 64;

export default function Sidebar() {
  const pathname    = usePathname();
  const wrapperRef  = useRef(null);
  const sidebarRef  = useRef(null);
  const toggleRef   = useRef(null);
  const planFillRef = useRef(null);
  const colRef      = useRef(false);
  const [collapsed, setCollapsed] = useState(false);

  // ── Entry reveal ──
  useEffect(() => {
    const sb      = sidebarRef.current;
    const items   = sb.querySelectorAll(".sb-item");
    const slabels = sb.querySelectorAll(".sb-section-label");
    const plan    = sb.querySelector(".sb-plan");

    gsap.fromTo(sb,
      { clipPath: "inset(0 100% 0 0)", x: -20 },
      { clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.6, ease: "power3.out" }
    );
    gsap.fromTo(slabels,
      { x: -12, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.38, ease: "power3.out", stagger: 0.055, delay: 0.32 }
    );
    gsap.fromTo(items,
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.38, ease: "power3.out", stagger: 0.04, delay: 0.35 }
    );
    gsap.fromTo(toggleRef.current,
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)", delay: 0.5 }
    );
    if (plan) {
      gsap.fromTo(plan,
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", delay: 0.62 }
      );
    }
    if (planFillRef.current) {
      gsap.to(planFillRef.current, { width: "72%", duration: 1.3, ease: "power2.out", delay: 0.88 });
    }
  }, []);

  // ── Collapse / Expand ──
  function toggleCollapse() {
    const sb       = sidebarRef.current;
    const wrapper  = wrapperRef.current;
    const textEls  = sb.querySelectorAll(".sb-label, .sb-badge, .sb-section-label, .sb-plan-text, .dash-logo-name, .dash-logo-sub");
    const plan     = sb.querySelector(".sb-plan");
    const togIcon  = toggleRef.current.querySelector(".sb-toggle-icon");
    const logoMark = sb.querySelector(".sb-logo-mark");

    if (!colRef.current) {
      // ── collapse ──
      colRef.current = true;
      setCollapsed(true);

      gsap.to(textEls, { opacity: 0, x: -8, duration: 0.15, ease: "power2.in" });
      gsap.to(plan, {
        opacity: 0, scaleY: 0.7, duration: 0.18, ease: "power2.in",
        onComplete: () => gsap.set(plan, { display: "none" })
      });
      gsap.to([sb, wrapper], { width: COLLAPSED_W, duration: 0.38, ease: "power3.inOut" });
      gsap.to(togIcon, { rotation: 180, duration: 0.35, ease: "back.out(1.5)" });
      gsap.to(logoMark, { marginLeft: "auto", marginRight: "auto", duration: 0.38, ease: "power3.inOut" });

    } else {
      // ── expand ──
      colRef.current = false;
      setCollapsed(false);

      gsap.to([sb, wrapper], { width: EXPANDED_W, duration: 0.4, ease: "power3.inOut" });
      gsap.to(logoMark, { marginLeft: 0, marginRight: 0, duration: 0.38, ease: "power3.inOut" });
      gsap.set(plan, { display: "block" });
      gsap.to(plan, { opacity: 1, scaleY: 1, duration: 0.35, ease: "back.out(1.7)", delay: 0.22 });
      gsap.to(textEls, { opacity: 1, x: 0, duration: 0.28, ease: "power3.out", stagger: 0.015, delay: 0.2 });
      gsap.to(togIcon, { rotation: 0, duration: 0.35, ease: "back.out(1.5)" });
    }

    // bounce toggle
    gsap.fromTo(toggleRef.current,
      { scale: 0.78 },
      { scale: 1, duration: 0.4, ease: "back.out(2.5)" }
    );
  }

  function handleNavClick(e) {
    const icon = e.currentTarget.querySelector(".sb-icon");
    gsap.fromTo(icon,
      { scale: 0.72, rotate: -10 },
      { scale: 1, rotate: 0, duration: 0.45, ease: "back.out(2.8)" }
    );
  }
  function onEnter(e) {
    gsap.to(e.currentTarget.querySelector(".sb-icon"), { scale: 1.12, duration: 0.18, ease: "power2.out" });
  }
  function onLeave(e) {
    gsap.to(e.currentTarget.querySelector(".sb-icon"), { scale: 1, duration: 0.18, ease: "power2.out" });
  }

  return (
    // Wrapper is position:relative so toggle can sit on its right edge
    <div ref={wrapperRef} className="sb-wrapper" style={{ width: EXPANDED_W }}>

      {/* Toggle — OUTSIDE sidebar so overflow:hidden never clips it */}
      <button ref={toggleRef} className="sb-toggle" onClick={toggleCollapse} aria-label="Toggle sidebar">
        <span className="material-symbols-outlined sb-toggle-icon">chevron_left</span>
      </button>

      <aside ref={sidebarRef} className="sidebar" style={{ width: "100%", overflow: "hidden" }}>

        {/* Logo */}
        <div className="sb-logo">
          <div className="dash-logo-mark sb-logo-mark">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: 16 }}>work</span>
          </div>
          <div className="sb-logo-text sb-label" style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
            <div className="dash-logo-name">WorKiya</div>
            <div className="dash-logo-sub">Super Admin Console</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {sections.map(({ label, items }) => (
            <div key={label}>
              <div className="sidebar-section-label sb-section-label">{label}</div>
              {items.map(({ label: lbl, href, icon }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`sidebar-link sb-item${active ? " active" : ""}`}
                    onClick={handleNavClick}
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                  >
                    <span className="sb-icon">
                      <span className="material-symbols-outlined"
                        style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0", fontSize: 18 }}>
                        {icon}
                      </span>
                    </span>
                    <span className="sb-label">{lbl}</span>
                    {collapsed && <span className="sb-tooltip">{lbl}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
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

          {[
            { href: "/dashboard/settings", icon: "settings", label: "Settings" },
            { href: "/dashboard/billing",  icon: "payments", label: "Billing"  },
          ].map(({ href, icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`sidebar-link sb-item${pathname === href ? " active" : ""}`}
              onClick={handleNavClick}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
            >
              <span className="sb-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
              </span>
              <span className="sb-label">{label}</span>
              {collapsed && <span className="sb-tooltip">{label}</span>}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}
