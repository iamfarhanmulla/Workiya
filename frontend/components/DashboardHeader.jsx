"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardHeader() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  /* Close menu on outside click */
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
    } catch (_) { /* ignore */ }
    router.push("/");
  }

  return (
    <header className="dash-header">
      {/* Search */}
      <div className="dash-search">
        <span className="material-symbols-outlined">search</span>
        <input type="text" placeholder="Search resources, employees, tasks..." />
      </div>

      {/* Assign New Task — right next to search */}
      <button className="dash-assign-btn">
        <span className="material-symbols-outlined">add</span>
        Assign New Task
      </button>

      {/* Right icons */}
      <div className="dash-header-actions">
        <button className="dash-icon-btn" aria-label="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="dash-icon-btn" aria-label="Apps">
          <span className="material-symbols-outlined">apps</span>
        </button>
        <button className="dash-icon-btn" aria-label="Help">
          <span className="material-symbols-outlined">help</span>
        </button>

        {/* Divider */}
        <div className="dash-header-divider" />

        {/* User profile */}
        <div className="dash-user-wrap" ref={menuRef}>
          <button className="dash-user-btn" onClick={() => setMenuOpen(o => !o)}>
            <div className="dash-user-info">
              <span className="dash-user-name">Alex Thompson</span>
              <span className="dash-user-role">System Architect</span>
            </div>
            <div className="dash-user-avatar">
              <span className="material-symbols-outlined" style={{ fontVariationSettings:"'FILL' 1", fontSize: 28, color: "#24339a" }}>account_circle</span>
            </div>
          </button>

          {menuOpen && (
            <div className="dash-user-menu">
              <div className="dash-user-menu-header">
                <p className="dash-user-menu-name">Alex Thompson</p>
                <p className="dash-user-menu-role">System Architect</p>
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
