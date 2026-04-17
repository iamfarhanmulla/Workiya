"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { clearUser, selectUser } from "@/store/authSlice";
import { getInitials, getDisplayName } from "@/hooks/useCurrentUser";
import { useTheme } from "@/components/ThemeProvider";

export default function DashboardHeader() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, { method: "POST" });
    } catch (_) { }
    dispatch(clearUser());
    router.push("/");
  }

  return (
    <header className="dash-header">
      {/* Logo */}
      {/* <div className="dash-logo ">
        <div className="dash-logo-mark">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: 16 }}>work</span>
        </div>
        <div>
          <div className="dash-logo-name">WorKiya</div>
          <div className="dash-logo-sub">Super Admin Console</div>
        </div>
      </div> */}

      <div className="dash-sep" />

      {/* Search */}
      <div className="dash-search">
        <span className="material-symbols-outlined">search</span>
        <input type="text" placeholder="Global search — companies, managers, tasks..." />
      </div>

      {/* Right actions */}
      <div className="dash-header-actions">
        {/* Assign New Task */}
        <button className="dash-assign-btn">
          <span className="material-symbols-outlined">add</span>
          New Task
        </button>

        {/* Icon buttons */}
        <div className="dash-icon-wrap">
          <button className="dash-icon-btn" aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <span className="dash-notif-dot" />
        </div>
        <button className="dash-icon-btn" aria-label="Apps">
          <span className="material-symbols-outlined">apps</span>
        </button>
        <button className="dash-icon-btn" aria-label="Help">
          <span className="material-symbols-outlined">help</span>
        </button>

        {/* Dark / Light toggle */}
        <button className="dash-theme-toggle" onClick={toggle} aria-label="Toggle theme">
          <div className="dash-theme-pill">
            <div className="dash-theme-thumb">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                {theme === "dark" ? "dark_mode" : "light_mode"}
              </span>
            </div>
          </div>
          <span className="dash-theme-label">{theme === "dark" ? "Dark" : "Light"}</span>
        </button>

        <div className="dash-header-divider" />

        {/* User profile dropdown */}
        <div className="dash-user-wrap" ref={menuRef}>
          <button className="dash-user-btn" onClick={() => setMenuOpen(o => !o)}>
            <div className="dash-user-avatar-pill">{getInitials(user)}</div>
            <div className="dash-user-info">
              <span className="dash-user-name">{getDisplayName(user)}</span>
              <span className="dash-user-role">{user?.roleName || "—"}</span>
            </div>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#94A3B8" }}>
              {menuOpen ? "expand_less" : "expand_more"}
            </span>
          </button>

          {menuOpen && (
            <div className="dash-user-menu">
              <div className="dash-user-menu-header">
                <p className="dash-user-menu-name">{getDisplayName(user)}</p>
                <p className="dash-user-menu-role">{user?.email || ""}</p>
              </div>
              <hr className="dash-user-menu-divider" />
              <button className="dash-user-menu-item">
                <span className="material-symbols-outlined">person</span>
                My Profile
              </button>
              <button className="dash-user-menu-item">
                <span className="material-symbols-outlined">settings</span>
                Account Settings
              </button>
              <hr className="dash-user-menu-divider" />
              <button className="dash-user-menu-item dash-user-menu-item--danger" onClick={handleLogout}>
                <span className="material-symbols-outlined">logout</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
