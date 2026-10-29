"use client";

import { ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ListBody } from "@/components/DataStates";
import ListToolbar from "@/components/ListToolbar";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import Paged from "@/components/Paged";
import ManagerFormModal from "./_components/ManagerFormModal";
import ManagerViewModal from "./_components/ManagerViewModal";
import ManagersTable from "./_components/ManagersTable";
import useManagersPage from "./_components/useManagersPage";
import { managerCounts } from "./_components/managerForm";

const STATUS_OPTIONS = ["Active", "Inactive"].map((s) => ({ value: s, label: s }));

function ManagerStats({ managers }) {
  const c = managerCounts(managers);
  const tiles = [
    ["supervisor_account", "Total managers", c.total, "Across all companies"],
    ["check_circle", "Active", c.active, "Can sign in"],
    ["block", "Inactive", c.inactive, "Cannot sign in"],
    ["badge", "Employees led", c.employees, "In their teams"],
  ];
  return (
    <div className="wk-kpis">
      {tiles.map(([icon, label, value, foot]) => (
        <StatTile key={label} icon={icon} label={label} value={value}>
          <span className="wk-stat-foot">{foot}</span>
        </StatTile>
      ))}
    </div>
  );
}

function ManagerDialogs({ page }) {
  const { dialog } = page;
  if (!dialog) return null;
  if (dialog.kind === "view") {
    return (
      <ManagerViewModal
        manager={dialog.manager}
        onClose={page.closeDialog}
        onEdit={page.handlers.onEdit}
      />
    );
  }
  return (
    <ManagerFormModal
      manager={dialog.manager}
      companies={page.companies}
      onClose={page.closeDialog}
      onSaved={page.saved}
      showToast={page.showToast}
    />
  );
}

export default function ManagersPage() {
  const page = useManagersPage();
  const { filters, setFilter } = page;
  return (
    <div className="wk-app">
      <div className="wk-main">
        <ToastContainer toasts={page.toasts} />
        <PageHeader title="Managers" sub="Company managers and the field teams they lead">
          <button type="button" className="wk-btn wk-btn--primary" onClick={page.openAdd}>
            <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
            Add manager
          </button>
        </PageHeader>
        <ManagerStats managers={page.managers.items} />
        <section className="wk-card wk-results" aria-label="Managers">
          <ListToolbar
            search={filters.search}
            onSearch={setFilter("search")}
            searchLabel="Search managers"
            placeholder="Name or email…"
            filters={[
              {
                key: "company",
                label: "Company filter",
                allLabel: "All companies",
                value: filters.company,
                onChange: setFilter("company"),
                options: page.companies.map((c) => ({ value: String(c.Id), label: c.Name })),
              },
              {
                key: "status",
                label: "Status filter",
                allLabel: "All statuses",
                value: filters.status,
                onChange: setFilter("status"),
                options: STATUS_OPTIONS,
              },
            ]}
          />
          <ListBody
            list={page.managers}
            plural="managers"
            shown={page.shown.length}
            emptyTitle="No managers found"
            emptyText="Try another name, company or status."
          >
            <Paged items={page.shown}>
              {(rows) => <ManagersTable managers={rows} handlers={page.handlers} />}
            </Paged>
          </ListBody>
        </section>
        <ManagerDialogs page={page} />
        <ConfirmModal
          open={!!page.deleteTarget}
          title="Delete manager?"
          message="This will permanently remove this manager. This action cannot be undone."
          onConfirm={page.confirmDelete}
          onCancel={page.cancelDelete}
        />
      </div>
    </div>
  );
}
