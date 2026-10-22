"use client";

import { useCallback } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import VisitTypeModal from "./VisitTypeModal";
import useSettingsList from "./useSettingsList";
import useRowEditing from "./useRowEditing";
import {
  AddButton, RowActions, SectionTitle, StatusBadge,
} from "./FormBits";
import { deleteActivityType, listActivityTypes } from "./settingsApi";

const yesNo = (v) => (v ? "Yes" : "No");

function TypesTable({
  types, loading, onEdit, onDelete,
}) {
  if (loading) return <p className="stg-row-desc">Loading...</p>;
  if (types.length === 0) return <p className="stg-row-desc">No visit types yet.</p>;
  return (
    <div className="table-card" style={{ margin: 0 }}>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>Check-in</th>
            <th>Geofence</th>
            <th>Min photos</th>
            <th>Signature</th>
            <th>Customer OTP</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {types.map((x) => (
            <tr key={x.id}>
              <td>{x.name}</td>
              <td><code>{x.code}</code></td>
              <td>{yesNo(x.requiresCheckIn)}</td>
              <td>{x.geofenceMeters ? `${x.geofenceMeters} m` : "Off"}</td>
              <td>{x.minPhotos}</td>
              <td>{yesNo(x.requiresSignature)}</td>
              <td>{yesNo(x.requiresCustomerOtp)}</td>
              <td><StatusBadge active={x.isActive} /></td>
              <td>
                <RowActions name={x.name} onEdit={() => onEdit(x)} onDelete={() => onDelete(x)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TYPE_MESSAGES = {
  deleted: "Visit type deleted.", deleteFailed: "Failed to delete the visit type.",
};

export default function VisitTypesSection({ companyId, notify }) {
  const { reload } = useActivityTypes(companyId);
  const fetcher = useCallback(() => listActivityTypes(companyId), [companyId]);
  const { items, loading, refresh } = useSettingsList(
    fetcher,
    notify,
    "Failed to load visit types.",
  );
  const {
    editing, setEditing, deleting, setDeleting, changed, confirmDelete,
  } = useRowEditing({
    remove: (row) => deleteActivityType(row.id, companyId),
    afterChange: () => {
      refresh();
      reload();
    },
    notify,
    messages: TYPE_MESSAGES,
  });

  return (
    <div className="stg-section" style={{ "--stg-du": "0.2s" }}>
      <SectionTitle icon="fact_check" color="#10B981">Visit Types</SectionTitle>
      <AddButton label="Add Visit Type" onClick={() => setEditing({})} />
      <TypesTable types={items} loading={loading} onEdit={setEditing} onDelete={setDeleting} />
      {editing && (
        <VisitTypeModal
          type={editing.id ? editing : null}
          companyId={companyId}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={changed}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        title="Delete Visit Type"
        message={`"${deleting?.name || ""}" will no longer be offered for new visits.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
