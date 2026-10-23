"use client";

export default function AccountsHeader({
  singular, plural, canManage, onAdd, onTransfer,
}) {
  return (
    <div className="wk-page-hd">
      <div>
        <h1 className="wk-page-title">{plural}</h1>
        <p className="wk-page-sub">
          {canManage
            ? `Manage ${plural.toLowerCase()}, locations and rep coverage`
            : `${plural} assigned to you`}
        </p>
      </div>
      {canManage && (
        <div className="wk-actions">
          <button type="button" className="wk-btn wk-btn--secondary" onClick={onTransfer}>
            <span className="material-symbols-outlined" aria-hidden="true">swap_horiz</span>
            {`Transfer ${plural}`}
          </button>
          <button type="button" className="wk-btn wk-btn--primary" onClick={onAdd}>
            <span className="material-symbols-outlined" aria-hidden="true">add</span>
            {`Add ${singular}`}
          </button>
        </div>
      )}
    </div>
  );
}
