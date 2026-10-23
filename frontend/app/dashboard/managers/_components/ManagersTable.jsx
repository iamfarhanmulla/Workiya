"use client";

import RowButton from "@/components/RowButton";
import PersonCell, { ActiveState } from "@/components/PersonCell";
import { fmtDate } from "@/lib/format";
import { managerName } from "./managerForm";

const muted = (value) => value || <span className="wk-muted">—</span>;

function ManagerActions({ manager, handlers }) {
  return (
    <div className="wk-row-actions">
      <RowButton icon="visibility" label="View" onClick={() => handlers.onView(manager)} />
      <RowButton icon="edit" label="Edit" onClick={() => handlers.onEdit(manager)} />
      <RowButton
        icon={manager.IsActive ? "block" : "check_circle"}
        label={manager.IsActive ? "Deactivate" : "Activate"}
        onClick={() => handlers.onToggle(manager)}
      />
      <RowButton
        icon="delete"
        label="Delete"
        danger
        onClick={() => handlers.onDelete(manager.Id)}
      />
    </div>
  );
}

// handlers: { onView, onEdit, onToggle, onDelete }.
export default function ManagersTable({ managers, handlers }) {
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">Manager</th>
            <th scope="col">Company</th>
            <th scope="col">Phone</th>
            <th scope="col" className="num">Employees</th>
            <th scope="col" className="num">Tasks</th>
            <th scope="col">Status</th>
            <th scope="col">Joined</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {managers.map((m) => (
            <tr key={m.Id}>
              <td><PersonCell name={managerName(m)} sub={m.Email} /></td>
              <td>{muted(m.CompanyName)}</td>
              <td>{muted(m.PhoneNumber)}</td>
              <td className="num">{m.EmployeeCount || 0}</td>
              <td className="num">{m.TaskCount || 0}</td>
              <td><ActiveState isActive={m.IsActive} /></td>
              <td>{muted(fmtDate(m.CreatedAtUtc))}</td>
              <td className="col-actions"><ManagerActions manager={m} handlers={handlers} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
