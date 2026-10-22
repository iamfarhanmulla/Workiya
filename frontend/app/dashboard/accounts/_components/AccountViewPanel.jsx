"use client";

import CustomFieldValues from "@/components/CustomFieldValues";
import { useCustomFields } from "@/hooks/useCustomFields";
import Modal from "./Modal";
import { repNames } from "./AccountCard";
import { formatLocation } from "./accountForm";

const LABEL = {
  fontSize: 11,
  color: "#94A3B8",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

function detailRows(account) {
  const hasCoords = account.latitude !== null && account.latitude !== undefined;
  const coords = hasCoords ? `${account.latitude}, ${account.longitude}` : null;
  return [
    { icon: "call", label: "Phone", val: account.phoneNumber },
    { icon: "mail", label: "Email", val: account.email },
    { icon: "home", label: "Address", val: account.address },
    { icon: "location_on", label: "Location", val: formatLocation(account) },
    { icon: "explore", label: "Coordinates", val: coords },
    { icon: "group", label: "Assigned Reps", val: repNames(account) || "None" },
    { icon: "notes", label: "Notes", val: account.notes },
  ].filter((row) => row.val);
}

function DetailRow({ icon, label, val }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 16, color: "#6366F1", marginTop: 1, flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <div style={LABEL}>{label}</div>
        <div style={{
          fontSize: 13, color: "var(--ds-text)", fontWeight: 500, marginTop: 1,
        }}
        >
          {val}
        </div>
      </div>
    </div>
  );
}

export default function AccountViewPanel({
  account, singular, canManage, onClose, onEdit,
}) {
  const { fields } = useCustomFields("ACCOUNT", account.companyId);
  const footer = (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>Close</button>
      {canManage && (
        <button type="button" className="btn btn-primary btn-sm" onClick={() => onEdit(account)}>
          <span className="material-symbols-outlined">edit</span>
          Edit {singular}
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
      maxWidth={520}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {detailRows(account).map((row) => (
          <DetailRow key={row.label} icon={row.icon} label={row.label} val={row.val} />
        ))}
        <CustomFieldValues fields={fields || []} values={account.extraFields || {}} />
      </div>
    </Modal>
  );
}
