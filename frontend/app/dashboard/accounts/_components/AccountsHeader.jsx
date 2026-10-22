"use client";

export default function AccountsHeader({
  singular, plural, canManage, onAdd, onTransfer,
}) {
  return (
    <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
      <div className="page-hd-left">
        <div className="breadcrumb">
          <span className="material-symbols-outlined">home</span>
          <span className="material-symbols-outlined">chevron_right</span>
          <span className="breadcrumb-active">{plural}</span>
        </div>
        <h1 className="page-hd-title">{plural}</h1>
        <p className="page-hd-sub">
          {canManage
            ? `Manage ${plural.toLowerCase()}, locations and rep coverage`
            : `${plural} assigned to you`}
        </p>
      </div>
      {canManage && (
        <div className="page-hd-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onTransfer}>
            <span className="material-symbols-outlined">swap_horiz</span>
            Transfer {plural}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
            <span className="material-symbols-outlined">add</span>
            Add {singular}
          </button>
        </div>
      )}
    </div>
  );
}
