"use client";

import Modal from "@/components/Modal";
import PersonCell, { ActiveState } from "@/components/PersonCell";
import { fmtDate } from "@/lib/format";
import { managerName } from "./managerForm";

export default function ManagerViewModal({ manager, onClose, onEdit }) {
  const rows = [
    ["Company", manager.CompanyName || "—"],
    ["Phone", manager.PhoneNumber || "—"],
    ["Employees", manager.EmployeeCount || 0],
    ["Tasks", manager.TaskCount || 0],
    ["Joined", fmtDate(manager.CreatedAtUtc) || "—"],
  ];
  const footer = (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onClose}>Close</button>
      <button type="button" className="wk-btn wk-btn--primary" onClick={() => onEdit(manager)}>
        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
        Edit manager
      </button>
    </>
  );
  return (
    <Modal
      icon="supervisor_account"
      labelId="manager-view-title"
      title="Manager details"
      onClose={onClose}
      footer={footer}
    >
      <div className="wk-person-head">
        <PersonCell name={managerName(manager)} sub={manager.Email} />
        <ActiveState isActive={manager.IsActive} />
      </div>
      <dl className="wk-dl" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
