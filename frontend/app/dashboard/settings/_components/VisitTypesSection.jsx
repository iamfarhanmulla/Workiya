"use client";

import { useCallback } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState, SkeletonRows } from "@/components/DataStates";
import { useTerminology } from "@/hooks/useTerminology";
import { useActivityTypes } from "@/hooks/useActivityTypes";
import VisitTypeModal from "./VisitTypeModal";
import useSettingsList from "./useSettingsList";
import useRowEditing from "./useRowEditing";
import {
  AddButton, RowActions, SettingsCard, StatusBadge,
} from "./FormBits";
import { deleteActivityType, listActivityTypes } from "./settingsApi";

const yesNo = (v) => (v ? "Yes" : "No");

function TypesTable({
  types, loading, onEdit, onDelete,
}) {
  if (loading) return <SkeletonRows rows={3} />;
  if (types.length === 0) return <EmptyState icon="fact_check" title="No types yet" />;
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
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
            <th className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {types.map((x) => (
            <tr key={x.id}>
              <td className="is-primary">{x.name}</td>
              <td className="wk-mono">{x.code}</td>
              <td>{yesNo(x.requiresCheckIn)}</td>
              <td>{x.geofenceMeters ? `${x.geofenceMeters} m` : "Off"}</td>
              <td>{x.minPhotos}</td>
              <td>{yesNo(x.requiresSignature)}</td>
              <td>{yesNo(x.requiresCustomerOtp)}</td>
              <td><StatusBadge active={x.isActive} /></td>
              <td className="col-actions">
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
  const { t } = useTerminology();
  const activity = t("activity.singular");
  const plural = t("activity.plural").toLowerCase();
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
    <SettingsCard
      id="visit-types"
      title={`${activity} types`}
      desc="How strict check-in and proof are for each type"
      action={(
        <AddButton label={`Add ${activity.toLowerCase()} type`} onClick={() => setEditing({})} />
      )}
    >
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
        title={`Delete ${activity.toLowerCase()} type`}
        message={`"${deleting?.name || ""}" will no longer be offered for new ${plural}.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </SettingsCard>
  );
}
