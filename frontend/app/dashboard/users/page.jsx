"use client";

import { ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ListBody } from "@/components/DataStates";
import ListToolbar from "@/components/ListToolbar";
import PageHeader from "@/components/PageHeader";
import StatTile from "@/components/StatTile";
import UserFormModal from "./_components/UserFormModal";
import UsersTable from "./_components/UsersTable";
import useUsersPage from "./_components/useUsersPage";
import { userCounts } from "./_components/userForm";

function UserStats({ users }) {
  const c = userCounts(users);
  const tiles = [
    ["group", "Total users", c.total, "All platform users"],
    ["check_circle", "Active", c.active, "Can sign in"],
    ["supervisor_account", "Managers", c.managers, "Team leads"],
    ["badge", "Employees", c.employees, "Field reps"],
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

function UserFilters({ page }) {
  const { filters, setFilter } = page;
  const toOptions = (rows) => rows.map((r) => ({ value: String(r.Id), label: r.Name }));
  return (
    <ListToolbar
      search={filters.search}
      onSearch={setFilter("search")}
      searchLabel="Search users"
      placeholder="Name or email…"
      filters={[
        {
          key: "role",
          label: "Role filter",
          allLabel: "All roles",
          value: filters.role,
          onChange: setFilter("role"),
          options: page.roles.map((r) => ({ value: r.Name, label: r.Name })),
        },
        {
          key: "company",
          label: "Company filter",
          allLabel: "All companies",
          value: filters.company,
          onChange: setFilter("company"),
          options: toOptions(page.companies),
        },
        {
          key: "manager",
          label: "Manager filter",
          allLabel: "All managers",
          value: filters.manager,
          onChange: setFilter("manager"),
          options: page.managers,
        },
      ]}
    />
  );
}

export default function UsersPage() {
  const page = useUsersPage();
  return (
    <div className="wk-app">
      <div className="wk-main">
        <ToastContainer toasts={page.toasts} />
        <PageHeader title="Users" sub="Everyone who can sign in: admins, managers and employees">
          <button type="button" className="wk-btn wk-btn--secondary" onClick={page.users.reload}>
            <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
            Refresh
          </button>
          <button type="button" className="wk-btn wk-btn--primary" onClick={page.openAdd}>
            <span className="material-symbols-outlined" aria-hidden="true">person_add</span>
            Add user
          </button>
        </PageHeader>
        <UserStats users={page.users.items} />
        <section className="wk-card wk-results" aria-label="Users">
          <UserFilters page={page} />
          <ListBody
            list={page.users}
            plural="users"
            shown={page.shown.length}
            emptyTitle="No users match your search"
            emptyText="Try another name, role, company or manager."
          >
            <UsersTable users={page.shown} onEdit={page.openEdit} onDelete={page.askDelete} />
          </ListBody>
        </section>
        {page.dialog && (
          <UserFormModal
            user={page.dialog.user}
            roles={page.roles}
            companies={page.companies}
            onClose={page.closeDialog}
            onSaved={page.saved}
            showToast={page.showToast}
          />
        )}
        <ConfirmModal
          open={!!page.deleteTarget}
          title="Delete user?"
          message="This will permanently remove this user. This action cannot be undone."
          onConfirm={page.confirmDelete}
          onCancel={page.cancelDelete}
        />
      </div>
    </div>
  );
}
