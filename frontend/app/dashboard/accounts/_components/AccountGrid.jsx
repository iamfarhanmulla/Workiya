"use client";

import AccountCard from "./AccountCard";

export default function AccountGrid({ items, canManage, handlers }) {
  return (
    <div className="wk-account-grid">
      {items.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          canManage={canManage}
          handlers={handlers}
        />
      ))}
    </div>
  );
}
