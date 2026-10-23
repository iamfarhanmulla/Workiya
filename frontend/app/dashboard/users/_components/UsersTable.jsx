"use client";

import RowButton from "@/components/RowButton";
import PersonCell, { ActiveState } from "@/components/PersonCell";
import { fmtDate, personName } from "@/lib/format";

const muted = (value) => value || <span className="wk-muted">—</span>;

export default function UsersTable({ users, onEdit, onDelete }) {
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">User</th>
            <th scope="col">Role</th>
            <th scope="col">Company</th>
            <th scope="col">Manager</th>
            <th scope="col">Phone</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.Id}>
              <td><PersonCell name={personName(u)} sub={u.Email} /></td>
              <td>{u.RoleName ? <span className="wk-tag">{u.RoleName}</span> : muted()}</td>
              <td>{muted(u.CompanyName)}</td>
              <td>{muted(u.ManagerName?.trim())}</td>
              <td>{muted(u.PhoneNumber)}</td>
              <td><ActiveState isActive={u.IsActive} /></td>
              <td>{muted(fmtDate(u.CreatedAtUtc))}</td>
              <td className="col-actions">
                <div className="wk-row-actions">
                  <RowButton icon="edit" label="Edit" onClick={() => onEdit(u)} />
                  <RowButton icon="delete" label="Delete" danger onClick={() => onDelete(u.Id)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
