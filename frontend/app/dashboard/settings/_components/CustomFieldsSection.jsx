"use client";

import { useCallback, useState } from "react";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState, SkeletonRows } from "@/components/DataStates";
import { useTerminology } from "@/hooks/useTerminology";
import { useCustomFields } from "@/hooks/useCustomFields";
import CustomFieldModal from "./CustomFieldModal";
import useSettingsList from "./useSettingsList";
import useRowEditing from "./useRowEditing";
import {
  AddButton, RowActions, SettingsCard, StatusBadge,
} from "./FormBits";
import { deleteCustomField, listCustomFields } from "./settingsApi";

function FieldsTable({
  fields, loading, onEdit, onDelete,
}) {
  if (loading) return <SkeletonRows rows={3} />;
  if (fields.length === 0) return <EmptyState icon="dynamic_form" title="No fields yet" />;
  return (
    <div className="wk-table-wrap">
      <table className="wk-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Key</th>
            <th>Type</th>
            <th>Required</th>
            <th>Options</th>
            <th>Order</th>
            <th>Status</th>
            <th className="col-actions"><span className="wk-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.id}>
              <td className="is-primary">{f.label}</td>
              <td className="wk-mono">{f.fieldKey}</td>
              <td><span className="wk-tag">{f.dataType}</span></td>
              <td>{f.isRequired ? "Yes" : "No"}</td>
              <td>{f.options?.length ? f.options.join(", ") : "—"}</td>
              <td>{f.sortOrder}</td>
              <td><StatusBadge active={f.isActive} /></td>
              <td className="col-actions">
                <RowActions name={f.label} onEdit={() => onEdit(f)} onDelete={() => onDelete(f)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FIELD_MESSAGES = { deleted: "Field deleted.", deleteFailed: "Failed to delete the field." };

function EntityFields({
  entityType, title, companyId, notify,
}) {
  const { reload } = useCustomFields(entityType, companyId);
  const fetcher = useCallback(
    () => listCustomFields(entityType, companyId),
    [entityType, companyId],
  );
  const { items, loading, refresh } = useSettingsList(fetcher, notify, "Failed to load fields.");
  const {
    editing, setEditing, deleting, setDeleting, changed, confirmDelete,
  } = useRowEditing({
    remove: (row) => deleteCustomField(row.id, companyId),
    afterChange: () => {
      refresh();
      reload();
    },
    notify,
    messages: FIELD_MESSAGES,
  });

  return (
    <>
      <div className="wk-toolbar">
        <span className="wk-spacer" />
        <AddButton label={`Add ${title}`} onClick={() => setEditing({})} />
      </div>
      <FieldsTable fields={items} loading={loading} onEdit={setEditing} onDelete={setDeleting} />
      {editing && (
        <CustomFieldModal
          entityType={entityType}
          field={editing.id ? editing : null}
          companyId={companyId}
          title={title}
          notify={notify}
          onClose={() => setEditing(null)}
          onSaved={changed}
        />
      )}
      <ConfirmModal
        open={!!deleting}
        title={`Delete ${title}`}
        message={`"${deleting?.label || ""}" will be removed from forms. Saved values are kept.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

export default function CustomFieldsSection({ companyId, notify }) {
  const { t } = useTerminology();
  const [tab, setTab] = useState("ACCOUNT");
  const account = t("account.singular");
  const submission = t("submission.singular");
  const tabs = [
    { key: "ACCOUNT", label: `${account} fields`, item: `${account} field` },
    { key: "SUBMISSION", label: `${submission} questions`, item: `${submission} question` },
  ];
  const current = tabs.find((x) => x.key === tab);

  return (
    <SettingsCard
      id="custom-fields"
      title="Custom fields"
      desc="Extra fields on records and report questions, set per company"
    >
      <div className="wk-tabs" role="tablist" style={{ padding: "0 12px" }}>
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            className="wk-tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <EntityFields
        key={tab}
        entityType={tab}
        title={current.item}
        companyId={companyId}
        notify={notify}
      />
    </SettingsCard>
  );
}
