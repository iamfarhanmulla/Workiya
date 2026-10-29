"use client";

import { useTerminology } from "@/hooks/useTerminology";
import AccountActions from "./AccountActions";
import { AccountState, NameCell, RepChips } from "./AccountBits";
import { formatLocation } from "./accountForm";

export default function AccountTable({
  items, singular, canManage, handlers,
}) {
  const { t } = useTerminology();
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">{singular}</th>
            <th scope="col">Location</th>
            <th scope="col">Phone</th>
            <th scope="col">{`Assigned ${t("rep.plural")}`}</th>
            <th scope="col">Status</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((account) => (
            <tr key={account.id}>
              <td><NameCell account={account} /></td>
              <td>{formatLocation(account, ["city", "country"]) || "—"}</td>
              <td>{account.phoneNumber || "—"}</td>
              <td><RepChips account={account} /></td>
              <td><AccountState isActive={account.isActive} /></td>
              <td className="col-actions">
                <AccountActions account={account} canManage={canManage} handlers={handlers} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
