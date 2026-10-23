"use client";

import { ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ListBody } from "@/components/DataStates";
import ListToolbar from "@/components/ListToolbar";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import CompaniesTable from "./_components/CompaniesTable";
import CompanyFormModal from "./_components/CompanyFormModal";
import CompanyViewModal from "./_components/CompanyViewModal";
import useCompaniesPage from "./_components/useCompaniesPage";
import {
  PLAN_OPTIONS, STATUS_FILTER_OPTIONS, companyCounts,
} from "./_components/companyForm";

function CompanyStats({ companies }) {
  const c = companyCounts(companies);
  const tiles = [
    ["corporate_fare", "Total companies", c.total, "All organizations"],
    ["check_circle", "Active", c.active, `${c.inactive} inactive`],
    [
      "workspace_premium",
      "Enterprise",
      c.enterprise,
      `${c.professional} Professional · ${c.startup} Startup`,
    ],
    ["group", "Total users", c.users, `${c.managers} managers · ${c.employees} employees`],
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

function CompanyFilters({ page }) {
  const { filters, setFilter } = page;
  return (
    <ListToolbar
      search={filters.search}
      onSearch={setFilter("search")}
      searchLabel="Search companies"
      placeholder="Name, city or country…"
      filters={[
        {
          key: "plan",
          label: "Plan filter",
          allLabel: "All plans",
          value: filters.plan,
          onChange: setFilter("plan"),
          options: PLAN_OPTIONS,
        },
        {
          key: "status",
          label: "Status filter",
          allLabel: "All statuses",
          value: filters.status,
          onChange: setFilter("status"),
          options: STATUS_FILTER_OPTIONS,
        },
      ]}
    />
  );
}

function CompanyDialogs({ page }) {
  return (
    <>
      {page.dialog && (
        <CompanyFormModal
          company={page.dialog.company}
          onClose={page.closeDialog}
          onSaved={page.saved}
          showToast={page.showToast}
        />
      )}
      {page.viewing && (
        <CompanyViewModal
          company={page.viewing}
          onClose={page.closeView}
          onEdit={page.editFromView}
        />
      )}
      <ConfirmModal
        open={!!page.deleteTarget}
        title="Delete company?"
        message="This will permanently remove this company. This action cannot be undone."
        onConfirm={page.confirmDelete}
        onCancel={page.cancelDelete}
      />
    </>
  );
}

export default function CompaniesPage() {
  const page = useCompaniesPage();
  const actions = {
    onView: page.openView,
    onEdit: page.openEdit,
    onToggle: page.toggleStatus,
    onDelete: page.askDelete,
  };
  return (
    <div className="wk-app">
      <div className="wk-main">
        <ToastContainer toasts={page.toasts} />
        <PageHeader title="Companies" sub="Manage organizations on the WorKiya platform">
          <button
            type="button"
            className="wk-btn wk-btn--secondary"
            onClick={page.companies.reload}
          >
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            Refresh
          </button>
          <button type="button" className="wk-btn wk-btn--primary" onClick={page.openAdd}>
            <span className="material-symbols-outlined" aria-hidden="true">add_business</span>
            Add company
          </button>
        </PageHeader>
        <CompanyStats companies={page.companies.items} />
        <section className="wk-card wk-results" aria-label="Companies">
          <CompanyFilters page={page} />
          <ListBody
            list={page.companies}
            plural="companies"
            shown={page.shown.length}
            emptyTitle="No companies match your search"
            emptyText="Try another name, plan or status."
          >
            <CompaniesTable companies={page.shown} actions={actions} />
          </ListBody>
        </section>
        <CompanyDialogs page={page} />
      </div>
    </div>
  );
}
