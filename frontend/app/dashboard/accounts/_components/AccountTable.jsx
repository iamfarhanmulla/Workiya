"use client";

import AccountActions from "./AccountActions";
import { repNames } from "./AccountCard";
import { formatLocation } from "./accountForm";

const COLUMNS = ["Location", "Phone", "Assigned Reps", "Status", "Actions"];
const AVATAR_GRADIENT = "linear-gradient(135deg,#06B6D4,#6366F1)";

function EmptyRow({ plural }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length + 1}>
        <div className="page-placeholder" style={{ minHeight: 140 }}>
          <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
          <p>No {plural.toLowerCase()} found.</p>
        </div>
      </td>
    </tr>
  );
}

function NameCell({ account }) {
  return (
    <div className="avatar-cell">
      <div className="avatar avatar-circle" style={{ background: AVATAR_GRADIENT }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: "#fff", fontVariationSettings: "'FILL' 1" }}
        >
          storefront
        </span>
      </div>
      <div>
        <div className="cell-name">{account.name}</div>
        {account.email && <div className="cell-sub">{account.email}</div>}
      </div>
    </div>
  );
}

function AccountRow({
  account, index, canManage, handlers,
}) {
  return (
    <tr style={{ animation: `docFadeUp 0.3s ease ${index * 0.04}s both` }}>
      <td><NameCell account={account} /></td>
      <td>{formatLocation(account, ["city", "country"]) || "—"}</td>
      <td>{account.phoneNumber || "—"}</td>
      <td>{repNames(account) || "—"}</td>
      <td>
        <span className={`badge ${account.isActive ? "badge-active" : "badge-inactive"}`}>
          {account.isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td>
        <AccountActions
          className="action-btns"
          account={account}
          canManage={canManage}
          handlers={handlers}
        />
      </td>
    </tr>
  );
}

export default function AccountTable({
  items, singular, plural, canManage, handlers,
}) {
  return (
    <div style={{ margin: "0 20px 20px" }}>
      <div className="table-card" style={{ margin: 0 }}>
        <table>
          <thead>
            <tr>
              <th>{singular}</th>
              {COLUMNS.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((account, i) => (
              <AccountRow
                key={account.id}
                account={account}
                index={i}
                canManage={canManage}
                handlers={handlers}
              />
            ))}
            {items.length === 0 && <EmptyRow plural={plural} />}
          </tbody>
        </table>
      </div>
    </div>
  );
}
