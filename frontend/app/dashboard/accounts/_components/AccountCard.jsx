"use client";

import { useTerminology } from "@/hooks/useTerminology";
import AccountActions from "./AccountActions";
import { AccountState, RepChips } from "./AccountBits";
import { formatLocation } from "./accountForm";
import { initials } from "../../activities/_components/activityConfig";

function InfoRow({ icon, label, children }) {
  return (
    <div className="wk-account-card-row">
      <dt>
        <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
        <span className="wk-sr">{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function AccountCard({ account, canManage, handlers }) {
  const { t } = useTerminology();
  const location = formatLocation(account);
  return (
    <article className="wk-card wk-account-card">
      <div className="wk-account-card-top">
        <span className="wk-avatar wk-avatar--lg wk-avatar--slate" aria-hidden="true">
          {initials(account.name)}
        </span>
        <div className="wk-list-main">
          <h3 className="wk-account-card-name">{account.name}</h3>
          {account.email && <div className="wk-person-meta">{account.email}</div>}
        </div>
        <AccountState isActive={account.isActive} />
      </div>
      <dl className="wk-account-card-info">
        {location && <InfoRow icon="location_on" label="Location">{location}</InfoRow>}
        {account.phoneNumber && <InfoRow icon="call" label="Phone">{account.phoneNumber}</InfoRow>}
        <InfoRow icon="group" label={`Assigned ${t("rep.plural")}`}>
          <RepChips account={account} />
        </InfoRow>
      </dl>
      <div className="wk-account-card-ft">
        {canManage ? (
          <button
            type="button"
            className="wk-btn wk-btn--secondary wk-btn--sm"
            onClick={() => handlers.onToggle(account)}
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
    </article>
  );
}
