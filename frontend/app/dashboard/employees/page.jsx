"use client";

import { ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ListBody } from "@/components/DataStates";
import ListToolbar from "@/components/ListToolbar";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import Paged from "@/components/Paged";
import EmployeeFormModal from "./_components/EmployeeFormModal";
import EmployeeViewModal from "./_components/EmployeeViewModal";
import EmployeesTable from "./_components/EmployeesTable";
import useEmployeesPage from "./_components/useEmployeesPage";
import { employeeCounts } from "./_components/employeeForm";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

function EmployeeStats({ employees }) {
  const c = employeeCounts(employees);
  const tiles = [
    ["group", "Total employees", c.total, "All employees"],
    ["check_circle", "Active", c.active, "Currently active"],
    ["cancel", "Inactive", c.inactive, "Deactivated"],
    ["task_alt", "Total tasks", c.tasks, "Assigned across all"],
  ];
  return (
    <div className="wk-kpis">
      {tiles.map(([icon, label, value, foot]) => (
        <StatTile key={label} icon={icon} label={label} value={value.toLocaleString()}>
          <span className="wk-stat-foot">{foot}</span>
        </StatTile>
      ))}
    </div>
  );
}

function EmployeeFilters({ page }) {
  const { filters, setFilter } = page;
  return (
    <ListToolbar
      search={filters.search}
      onSearch={setFilter("search")}
      searchLabel="Search employees"
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
  );
}

function EmployeeDialogs({ page }) {
  return (
    <>
      {page.dialog && (
        <EmployeeFormModal
          employee={page.dialog.employee}
          companies={page.companies}
          managers={page.managers}
          onClose={page.closeDialog}
          onSaved={page.saved}
          showToast={page.showToast}
        />
      )}
      {page.viewTarget && (
        <EmployeeViewModal
          employee={page.viewTarget}
          onClose={page.closeView}
          onEdit={page.openEdit}
        />
      )}
      <ConfirmModal
        open={!!page.deleteTarget}
        title="Delete employee?"
        message="This will permanently remove this employee. This action cannot be undone."
        onConfirm={page.confirmDelete}
        onCancel={page.cancelDelete}
      />
    </>
  );
}

export default function EmployeesPage() {
  const page = useEmployeesPage();
  const actions = {
    onView: page.openView,
    onEdit: page.openEdit,
    onToggle: page.toggleActive,
    onDelete: page.askDelete,
  };
  return (
    <div className="wk-app">
      <div className="wk-main">
        <ToastContainer toasts={page.toasts} />
        <PageHeader title="Employees" sub="Manage field employees and their assignments">
          <button
            type="button"
            className="wk-btn wk-btn--secondary"
            onClick={page.employees.reload}
          >
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            Refresh
          </button>
          <button type="button" className="wk-btn wk-btn--primary" onClick={page.openAdd}>
            <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
            Add employee
          </button>
        </PageHeader>
        <EmployeeStats employees={page.employees.items} />
        <section className="wk-card wk-results" aria-label="Employees">
          <EmployeeFilters page={page} />
          <ListBody
            list={page.employees}
            plural="employees"
            shown={page.shown.length}
            emptyTitle="No employees match your search"
            emptyText="Try another name, email, company or status."
          >
            <Paged items={page.shown}>
              {(rows) => <EmployeesTable employees={rows} actions={actions} />}
            </Paged>
          </ListBody>
        </section>
        <EmployeeDialogs page={page} />
      </div>
    </div>
  );
}
