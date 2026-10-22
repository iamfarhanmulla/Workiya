"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, selectUser } from "@/store/authSlice";
import { getInitials, getDisplayName } from "@/hooks/useCurrentUser";
import { useTerminology } from "@/hooks/useTerminology";
import { useTheme } from "@/components/ThemeProvider";

function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button type="button" className="dash-theme-toggle" onClick={toggle} aria-label="Toggle theme">
      <div className="dash-theme-pill">
        <div className="dash-theme-thumb">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            {theme === "dark" ? "dark_mode" : "light_mode"}
          </span>
        </div>
      </div>
      <span className="dash-theme-label">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}

const ACTIVITY_CREATORS = ["SUPER_ADMIN", "ADMIN", "MANAGER"];

// Shortcut to the activities page, named with the company's term, for roles that create them.
function NewActivityLink() {
  const user = useSelector(selectUser);
  const { t } = useTerminology();
  if (!ACTIVITY_CREATORS.includes(user?.roleCode)) return null;
  return (
    <Link href="/dashboard/activities" className="dash-assign-btn">
      <span className="material-symbols-outlined">add</span>
      {`New ${t("activity.singular")}`}
    </Link>
  );
}

function UserMenuItems({ user, onLogout, logoutError }) {
  return (
    <div className="dash-user-menu">
      <div className="dash-user-menu-header">
        <p className="dash-user-menu-name">{getDisplayName(user)}</p>
        <p className="dash-user-menu-role">{user?.email || ""}</p>
      </div>
      {logoutError && (
        <p
          className="dash-user-menu-role"
          role="alert"
          style={{ color: "var(--ds-danger)", padding: "0 10px" }}
        >
          {logoutError}
        </p>
      )}
      <hr className="dash-user-menu-divider" />
      <button type="button" className="dash-user-menu-item">
        <span className="material-symbols-outlined">person</span>
        My Profile
      </button>
      <button type="button" className="dash-user-menu-item">
        <span className="material-symbols-outlined">settings</span>
        Account Settings
      </button>
      <hr className="dash-user-menu-divider" />
      <button
        type="button"
        className="dash-user-menu-item dash-user-menu-item--danger"
        onClick={onLogout}
      >
        <span className="material-symbols-outlined">logout</span>
        Logout
      </button>
    </div>
  );
}

function UserMenu() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // If the API never revoked the session, the cookies are still set and the proxy would
  // bounce "/" back to the dashboard, so stay here and say so instead.
  const handleLogout = async () => {
    setLogoutError("");
    const result = await dispatch(logoutUser());
    if (logoutUser.rejected.match(result)) {
      setLogoutError("Could not sign out. Check your connection and try again.");
      return;
    }
    router.push("/");
  };

  return (
    <div className="dash-user-wrap" ref={menuRef}>
      <button type="button" className="dash-user-btn" onClick={() => setMenuOpen((o) => !o)}>
        <div className="dash-user-avatar-pill">{getInitials(user)}</div>
        <div className="dash-user-info">
          <span className="dash-user-name">{getDisplayName(user)}</span>
          <span className="dash-user-role">{user?.roleName || "—"}</span>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#94A3B8" }}>
          {menuOpen ? "expand_less" : "expand_more"}
        </span>
      </button>

      {menuOpen && <UserMenuItems user={user} onLogout={handleLogout} logoutError={logoutError} />}
    </div>
  );
}

export default function DashboardHeader() {
  return (
    <header className="dash-header">
      <div className="dash-sep" />

      <div className="dash-search">
        <span className="material-symbols-outlined">search</span>
        <input type="text" placeholder="Global search — companies, managers, employees..." />
      </div>

      <div className="dash-header-actions">
        <NewActivityLink />

        <div className="dash-icon-wrap">
          <button type="button" className="dash-icon-btn" aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <span className="dash-notif-dot" />
        </div>
        <button type="button" className="dash-icon-btn" aria-label="Apps">
          <span className="material-symbols-outlined">apps</span>
        </button>
        <button type="button" className="dash-icon-btn" aria-label="Help">
          <span className="material-symbols-outlined">help</span>
        </button>

        <ThemeToggle />

        <div className="dash-header-divider" />

        <UserMenu />
      </div>
    </header>
  );
}
