"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { logoutUser, selectUser } from "@/store/authSlice";
import { getDisplayName, getInitials } from "@/hooks/useCurrentUser";
import Dropdown from "@/components/Dropdown";

function UserMenuPanel({
  name, user, logoutError, onLogout,
}) {
  return (
    <>
      <div className="wk-menu-head">
        <div className="wk-menu-head-title">{name}</div>
        <div className="wk-menu-head-sub">
          {[user?.roleName, user?.email].filter(Boolean).join(" · ")}
        </div>
      </div>
      {logoutError && (
        <p className="wk-error-text" role="alert" style={{ padding: "4px 10px" }}>
          {logoutError}
        </p>
      )}
      <button type="button" className="wk-menu-item wk-menu-item--danger" onClick={onLogout}>
        <span className="material-symbols-outlined" aria-hidden="true">logout</span>
        Sign out
      </button>
    </>
  );
}

export default function UserMenu() {
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const [logoutError, setLogoutError] = useState("");
  const name = getDisplayName(user);
  const role = user?.roleName ? `, ${user.roleName}` : "";

  // If the API never revoked the session, the cookies are still set and the proxy would
  // bounce "/" back to the dashboard, so stay here and say so instead.
  const handleLogout = useCallback(async () => {
    setLogoutError("");
    const result = await dispatch(logoutUser());
    if (logoutUser.rejected.match(result)) {
      setLogoutError("Could not sign out. Check your connection and try again.");
      return;
    }
    router.push("/");
  }, [dispatch, router]);

  return (
    <Dropdown
      align="end"
      triggerClassName="wk-btn wk-btn--ghost wk-topnav-user"
      triggerLabel={`Account menu: ${name}${role}`}
      triggerContent={(
        <>
          <span className="wk-avatar" aria-hidden="true">{getInitials(user)}</span>
          <span className="material-symbols-outlined wk-icon--sm" aria-hidden="true">
            expand_more
          </span>
        </>
      )}
    >
      {() => (
        <UserMenuPanel name={name} user={user} logoutError={logoutError} onLogout={handleLogout} />
      )}
    </Dropdown>
  );
}
