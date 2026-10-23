"use client";

import CustomFieldValues from "@/components/CustomFieldValues";
import Modal from "@/components/Modal";
import { useCustomFields } from "@/hooks/useCustomFields";
import { repNames } from "./AccountBits";
import { formatLocation } from "./accountForm";

function detailRows(account) {
  const hasCoords = account.latitude !== null && account.latitude !== undefined;
  const coords = hasCoords ? `${account.latitude}, ${account.longitude}` : null;
  return [
    { icon: "call", label: "Phone", val: account.phoneNumber },
    { icon: "mail", label: "Email", val: account.email },
    { icon: "home_pin", label: "Address", val: account.address },
    { icon: "location_on", label: "Location", val: formatLocation(account) },
    {
      icon: "my_location", label: "Coordinates", val: coords, mono: true,
    },
    { icon: "group", label: "Assigned Reps", val: repNames(account) || "None" },
    { icon: "notes", label: "Notes", val: account.notes },
  ].filter((row) => row.val);
}

export default function AccountViewPanel({
  account, singular, canManage, onClose, onEdit,
}) {
  const { fields } = useCustomFields("ACCOUNT", account.companyId);
  const footer = (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onClose}>Close</button>
      {canManage && (
        <button type="button" className="wk-btn wk-btn--primary" onClick={() => onEdit(account)}>
          <span className="material-symbols-outlined" aria-hidden="true">edit</span>
          {`Edit ${singular}`}
        </button>
      )}
    </>
  );
  return (
    <Modal
      icon="storefront"
      labelId="account-view-title"
      title={account.name}
      sub={account.isActive ? `Active ${singular}` : `Inactive ${singular}`}
      onClose={onClose}
      footer={footer}
    >
      <dl className="wk-dl" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {detailRows(account).map((row) => (
          <div key={row.label}>
            <dt>
              <span className="material-symbols-outlined wk-icon--sm" aria-hidden="true">
                {row.icon}
              </span>
              {row.label}
            </dt>
            <dd className={row.mono ? "wk-mono" : undefined}>{row.val}</dd>
          </div>
        ))}
      </dl>
      <CustomFieldValues fields={fields || []} values={account.extraFields || {}} />
    </Modal>
  );
}
