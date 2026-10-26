"use client";

import { initials } from "../../activities/_components/activityConfig";

export function repNames(account) {
  return (account.assignedUsers || []).map((u) => u.displayName).filter(Boolean).join(", ");
}

export function AccountState({ isActive }) {
  return (
    <span className={`wk-state${isActive ? " wk-state--active" : ""}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

export function NameCell({ account }) {
  return (
    <div className="wk-person">
      <span className="wk-avatar wk-avatar--slate" aria-hidden="true">
        {initials(account.name)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="wk-person-name">{account.name}</div>
        {account.email && <div className="wk-person-meta">{account.email}</div>}
      </div>
    </div>
  );
}

// Up to three rep avatars, then the names as text (read by screen readers too).
export function RepChips({ account }) {
  const users = account.assignedUsers || [];
  if (!users.length) return <span className="wk-muted">No rep</span>;
  return (
    <div className="wk-rep-chips">
      <span className="wk-avatars" aria-hidden="true">
        {users.slice(0, 3).map((u) => (
          <span key={u.userId} className="wk-avatar wk-avatar--xs">{initials(u.displayName)}</span>
        ))}
      </span>
      <span className="wk-rep-names">{repNames(account)}</span>
    </div>
  );
}
