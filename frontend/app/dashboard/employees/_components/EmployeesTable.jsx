"use client";

import RowButton from "@/components/RowButton";
import PersonCell, { ActiveState } from "@/components/PersonCell";
import { Meter } from "@/components/DataStates";
import { fmtDate } from "@/lib/format";
import { employeeName, taskProgress } from "./employeeForm";

const muted = (value) => value || <span className="wk-muted">—</span>;

export function TaskMeter({ employee }) {
  const { done, total, pct } = taskProgress(employee);
  return (
    <Meter
      pct={pct}
      tone={pct === 100 ? "success" : undefined}
      label={`${done}/${total}`}
      showLabel
    />
  );
}

function RowActions({ employee, actions }) {
  const active = Boolean(employee.IsActive);
  return (
    <div className="wk-row-actions">
      <RowButton icon="visibility" label="View" onClick={() => actions.onView(employee)} />
      <RowButton icon="edit" label="Edit" onClick={() => actions.onEdit(employee)} />
      <RowButton
        icon={active ? "block" : "check_circle"}
        label={active ? "Deactivate" : "Activate"}
        onClick={() => actions.onToggle(employee)}
      />
      <RowButton
        icon="delete"
        label="Delete"
        danger
        onClick={() => actions.onDelete(employee.Id)}
      />
    </div>
  );
}

// actions: { onView, onEdit, onToggle, onDelete }.
export default function EmployeesTable({ employees, actions }) {
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">Employee</th>
            <th scope="col">Company</th>
            <th scope="col">Manager</th>
            <th scope="col">Phone</th>
            <th scope="col">Tasks</th>
            <th scope="col">Status</th>
            <th scope="col">Joined</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.Id}>
              <td><PersonCell name={employeeName(e)} sub={e.Email} /></td>
              <td>{muted(e.CompanyName)}</td>
              <td>{muted(e.ManagerName?.trim())}</td>
              <td>{muted(e.PhoneNumber)}</td>
              <td><TaskMeter employee={e} /></td>
              <td><ActiveState isActive={e.IsActive} /></td>
              <td>{muted(fmtDate(e.CreatedAtUtc))}</td>
              <td className="col-actions"><RowActions employee={e} actions={actions} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
