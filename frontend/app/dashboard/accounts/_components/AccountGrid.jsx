"use client";

import AccountCard from "./AccountCard";

export default function AccountGrid({
  items, plural, canManage, handlers,
}) {
  return (
    <div className="doc-grid">
      {items.map((account, i) => (
        <AccountCard
          key={account.id}
          account={account}
          index={i}
          canManage={canManage}
          handlers={handlers}
        />
      ))}
      {items.length === 0 && (
        <div className="page-placeholder" style={{ gridColumn: "1/-1", minHeight: 200 }}>
          <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
          <p>No {plural.toLowerCase()} match your search.</p>
        </div>
      )}
    </div>
  );
}
