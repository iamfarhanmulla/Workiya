"use client";

import RowButton from "@/components/RowButton";
import PersonCell, { ActiveState } from "@/components/PersonCell";
import { fmtDate } from "@/lib/format";
import { companyLocation, planLabel, userCount } from "./companyForm";

const muted = (value) => value || <span className="wk-muted">—</span>;

function CompanyActions({ company, actions }) {
  const {
    onView, onEdit, onToggle, onDelete,
  } = actions;
  return (
    <div className="wk-row-actions">
      <RowButton icon="visibility" label="View" onClick={() => onView(company)} />
      <RowButton icon="edit" label="Edit" onClick={() => onEdit(company)} />
      <RowButton
        icon={company.IsActive ? "block" : "check_circle"}
        label={company.IsActive ? "Deactivate" : "Activate"}
        onClick={() => onToggle(company)}
      />
      <RowButton icon="delete" label="Delete" danger onClick={() => onDelete(company.Id)} />
    </div>
  );
}

// actions: { onView, onEdit, onToggle, onDelete }, each called with the row (Delete: its Id).
export default function CompaniesTable({ companies, actions }) {
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th scope="col">Company</th>
            <th scope="col">Plan</th>
            <th scope="col">Users</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col" className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.Id}>
              <td>
                <PersonCell name={c.Name} sub={companyLocation(c) || c.Key} square />
              </td>
              <td>{c.Plan ? <span className="wk-tag">{planLabel(c.Plan)}</span> : muted()}</td>
              <td>{userCount(c)}</td>
              <td><ActiveState isActive={c.IsActive} /></td>
              <td>{muted(fmtDate(c.CreatedAtUtc))}</td>
              <td className="col-actions">
                <CompanyActions company={c} actions={actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
