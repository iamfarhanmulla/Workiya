"use client";

import Modal from "@/components/Modal";
import PersonCell, { ActiveState } from "@/components/PersonCell";
import { fmtDate } from "@/lib/format";
import { employeeName, taskProgress } from "./employeeForm";

function detailRows(employee) {
  const { done, total } = taskProgress(employee);
  return [
    { icon: "apartment", label: "Company", val: employee.CompanyName },
    { icon: "supervisor_account", label: "Manager", val: employee.ManagerName?.trim() },
    { icon: "call", label: "Phone", val: employee.PhoneNumber },
    { icon: "task_alt", label: "Tasks", val: `${done} / ${total} completed` },
    { icon: "event", label: "Joined", val: fmtDate(employee.CreatedAtUtc) },
  ];
}

// Read-only profile with a shortcut to the edit dialog.
export default function EmployeeViewModal({ employee, onClose, onEdit }) {
  const footer = (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onClose}>Close</button>
      <button type="button" className="wk-btn wk-btn--primary" onClick={() => onEdit(employee)}>
        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
        Edit employee
      </button>
    </>
  );
  return (
    <Modal
      icon="badge"
      labelId="employee-view-title"
      title="Employee details"
      sub="Full profile information"
      onClose={onClose}
      footer={footer}
    >
      <div className="wk-person-head">
        <PersonCell name={employeeName(employee)} sub={employee.Email} />
        <ActiveState isActive={employee.IsActive} />
      </div>
      <dl className="wk-dl wk-dl--2col">
        {detailRows(employee).map((row) => (
          <div key={row.label}>
            <dt>
              <span className="material-symbols-outlined wk-icon--sm" aria-hidden="true">
                {row.icon}
              </span>
              {row.label}
            </dt>
            <dd>{row.val || "—"}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
