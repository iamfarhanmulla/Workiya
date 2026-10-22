"use client";

import AccountActions from "./AccountActions";
import { formatLocation } from "./accountForm";

const BADGE = {
  position: "absolute",
  top: 8,
  right: 8,
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 20,
  letterSpacing: "0.5px",
};

const TOGGLE = {
  fontSize: 11,
  fontWeight: 600,
  padding: "4px 10px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};

function statusColors(isActive) {
  return isActive
    ? { background: "#D1FAE5", color: "#059669" }
    : { background: "#FEE2E2", color: "#DC2626" };
}

function InfoRow({ icon, children }) {
  return (
    <div className="doc-info-row">
      <span className="material-symbols-outlined">{icon}</span>
      {children}
    </div>
  );
}

export function repNames(account) {
  return (account.assignedUsers || []).map((u) => u.displayName).filter(Boolean).join(", ");
}

function MapStrip({ isActive }) {
  return (
    <div className="doc-map-preview">
      <div className="doc-map-grid" />
      <div className="doc-map-pin">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          location_on
        </span>
      </div>
      <div style={{ ...BADGE, ...statusColors(isActive) }}>{isActive ? "ACTIVE" : "INACTIVE"}</div>
    </div>
  );
}

export default function AccountCard({
  account, index, canManage, handlers,
}) {
  const location = formatLocation(account);
  const reps = repNames(account);
  return (
    <div className="doc-card" style={{ "--doc-du": `${index * 0.06}s` }}>
      <MapStrip isActive={account.isActive} />
      <div className="doc-card-top">
        <div className="doc-avatar">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            storefront
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="doc-name">{account.name}</div>
          {account.email && <div className="doc-spec">{account.email}</div>}
        </div>
      </div>
      {location && <InfoRow icon="location_on">{location}</InfoRow>}
      {account.phoneNumber && <InfoRow icon="call">{account.phoneNumber}</InfoRow>}
      <InfoRow icon="group">{reps || "No reps assigned"}</InfoRow>
      <div className="doc-card-footer">
        {canManage ? (
          <button
            type="button"
            onClick={() => handlers.onToggle(account)}
            style={{ ...TOGGLE, ...statusColors(!account.isActive) }}
          >
            {account.isActive ? "Deactivate" : "Activate"}
          </button>
        ) : <span />}
        <AccountActions
          account={account}
          canManage={canManage}
          handlers={{ ...handlers, onToggle: null }}
        />
      </div>
    </div>
  );
}
