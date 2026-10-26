"use client";

import Modal from "@/components/Modal";
import { ActiveState } from "@/components/PersonCell";
import { fmtDate } from "@/lib/format";
import { planLabel, userCount } from "./companyForm";

function detailRows(company) {
  return [
    { icon: "workspace_premium", label: "Plan", val: planLabel(company.Plan) },
    { icon: "toggle_on", label: "Status", val: <ActiveState isActive={company.IsActive} /> },
    { icon: "mail", label: "Contact email", val: company.ContactEmail },
    { icon: "call", label: "Contact phone", val: company.ContactPhone },
    { icon: "home_pin", label: "Address", val: company.Address },
    { icon: "location_city", label: "City", val: company.City },
    { icon: "public", label: "Country", val: company.Country },
    { icon: "group", label: "Users", val: userCount(company) },
    { icon: "badge", label: "Employees", val: company.EmployeeCount || 0 },
    { icon: "supervisor_account", label: "Managers", val: company.ManagerCount || 0 },
    { icon: "event", label: "Created", val: fmtDate(company.CreatedAtUtc) },
  ];
}

// Read-only company details; "Edit company" hands the row over to the edit dialog.
export default function CompanyViewModal({ company, onClose, onEdit }) {
  const footer = (
    <>
      <button type="button" className="wk-btn wk-btn--secondary" onClick={onClose}>Close</button>
      <button type="button" className="wk-btn wk-btn--primary" onClick={onEdit}>
        <span className="material-symbols-outlined" aria-hidden="true">edit</span>
        Edit company
      </button>
    </>
  );
  return (
    <Modal
      icon="corporate_fare"
      labelId="company-view-title"
      title={company.Name}
      sub={company.Key || "Company details"}
      onClose={onClose}
      footer={footer}
    >
      <dl className="wk-dl wk-dl--2col">
        {detailRows(company).map((row) => (
          <div key={row.label}>
            <dt>
              <span className="material-symbols-outlined wk-icon--sm" aria-hidden="true">
                {row.icon}
              </span>
              {row.label}
            </dt>
            <dd>{row.val === "" || row.val == null ? "—" : row.val}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
