"use client";

import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import {
  useState, useEffect, useRef, useCallback, memo,
} from "react";
import { api, getErrorMessage } from "@/lib/apiClient";
import activateOnKey from "@/app/dashboard/_utils/activateOnKey";

const ROLE_COLORS = {
  SuperAdmin: { bg: "#EDE9FE", color: "#8B5CF6" },
  Manager: { bg: "#EEF2FF", color: "#1E3A8A" },
  Employee: { bg: "#D1FAE5", color: "#10B981" },
};

function useCountUp(target, active, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal((1 - (1 - p) ** 3) * target);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [active, target, duration]);
  return val;
}

// Named function: keeps "StatCard" as the component name in React DevTools and error stacks.
// eslint-disable-next-line prefer-arrow-callback -- see comment above
const StatCard = memo(function StatCard({
  icon, bg, color, label, value, sub, index, active,
}) {
  const count = useCountUp(value, active);
  return (
    <div className="stat-card dash-anim-card" style={{ "--card-delay": `${index * 0.08}s` }}>
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: bg }}>
          <span
            className="material-symbols-outlined"
            style={{ color, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-val">{active ? Math.round(count).toLocaleString() : "0"}</p>
      <p className="stat-sub">{sub}</p>
    </div>
  );
});

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  middleName: "",
  email: "",
  username: "",
  password: "",
  phoneNumber: "",
  displayName: "",
  roleId: "",
  companyId: "",
  managerId: "",
  isActive: 1,
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [companyFilter, setCompanyFilter] = useState("All");
  const [managerFilter, setManagerFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null); // null = add, object = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { toasts, showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      const json = res.data;
      if (json.success) setUsers(json.data);
      else setError("Failed to load users.");
    } catch (err) {
      setError(err.response ? "Failed to load users." : "Cannot connect to server.");
    } finally {
      setLoading(false);
      setTimeout(() => setActive(true), 50);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.get("/users/roles");
      const json = res.data;
      if (json.success) setRoles(json.data);
    } catch {
      // Role list is optional here: the page still works without it.
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get("/users/companies");
      const json = res.data;
      if (json.success) setCompanies(json.data);
    } catch {
      // Company list is optional here: the page still works without it.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    fetchUsers();
    fetchRoles();
    fetchCompanies();
  }, [fetchUsers, fetchRoles, fetchCompanies]);

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.IsActive).length;
  const managers = users.filter((u) => u.RoleName === "Manager").length;
  const employees = users.filter((u) => u.RoleName === "Employee").length;

  const uniqueManagers = users
    .filter((u) => u.ManagerId)
    .reduce((acc, u) => {
      if (!acc.find((m) => m.id === u.ManagerId)) {
        acc.push({
          id: u.ManagerId,
          name: u.ManagerName?.trim() || "",
        });
      }
      return acc;
    }, []);

  const filtered = users.filter((u) => {
    const name = `${u.FirstName || ""} ${u.LastName || ""} ${u.Email || ""}`.toLowerCase();
    const ms = name.includes(search.toLowerCase());
    const mf = roleFilter === "All" || u.RoleName === roleFilter;
    const mc = companyFilter === "All" || String(u.CompanyId) === companyFilter;
    const mm = managerFilter === "All" || String(u.ManagerId) === managerFilter;
    return ms && mf && mc && mm;
  });

  function openAdd() {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({
      firstName: u.FirstName || "",
      lastName: u.LastName || "",
      middleName: u.MiddleName || "",
      email: u.Email || "",
      username: u.Username || "",
      password: "",
      phoneNumber: u.PhoneNumber || "",
      displayName: u.DisplayName || "",
      roleId: u.RoleId || "",
      companyId: u.CompanyId || "",
      managerId: u.ManagerId || "",
      isActive: u.IsActive ? 1 : 0,
    });
    setFormError("");
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditUser(null);
    setFormError("");
  }

  function setF(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave() {
    setFormError("");
    if (!form.email) {
      setFormError("Email is required.");
      return;
    }
    if (!form.roleId) {
      setFormError("Role is required.");
      return;
    }
    if (!editUser && !form.password) {
      setFormError("Password is required.");
      return;
    }

    setSaving(true);
    try {
      const body = { ...form };
      if (editUser && !body.password) delete body.password;

      const res = editUser
        ? await api.put(`/users/${editUser.Id}`, body)
        : await api.post("/users", body);
      const json = res.data;
      if (!json.success) {
        setFormError(json.message || "Failed to save.");
        return;
      }
      showToast(editUser ? "User updated successfully!" : "User created successfully!");
      closeModal();
      fetchUsers();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to save.");
      setFormError(msg);
      if (!err.response) showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    try {
      await api.delete(`/users/${deleteTarget}`);
      showToast("User deleted successfully!", "success");
      fetchUsers();
    } catch {
      showToast("Failed to delete user.", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const avatarColors = [
    "#8B5CF6", "#10B981", "#1E3A8A", "#F59E0B", "#EF4444", "#06B6D4", "#D946EF", "#3B5FCF",
  ];
  function getColor(id) {
    return avatarColors[id % avatarColors.length];
  }
  function initials(u) {
    const f = u.FirstName?.[0] || "";
    const l = u.LastName?.[0] || "";
    return (f + l).toUpperCase() || u.Email?.[0]?.toUpperCase() || "?";
  }

  const saveLabel = editUser ? "Update User" : "Add User";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Users</span>
          </div>
          <h1 className="page-hd-title">Users</h1>
          <p className="page-hd-sub">Manage platform users — admins, managers and employees</p>
        </div>
        <div className="page-hd-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={fetchUsers}>
            <span className="material-symbols-outlined">refresh</span>
            Refresh
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            <span className="material-symbols-outlined">add</span>
            Add User
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard
          index={0}
          icon="group"
          bg="#EEF2FF"
          color="#1E3A8A"
          label="Total Users"
          value={totalUsers}
          sub="All platform users"
          active={active}
        />
        <StatCard
          index={1}
          icon="check_circle"
          bg="#D1FAE5"
          color="#10B981"
          label="Active Users"
          value={activeUsers}
          sub="Currently active"
          active={active}
        />
        <StatCard
          index={2}
          icon="manage_accounts"
          bg="#EDE9FE"
          color="#8B5CF6"
          label="Managers"
          value={managers}
          sub="Company managers"
          active={active}
        />
        <StatCard
          index={3}
          icon="badge"
          bg="#FEF3C7"
          color="#F59E0B"
          label="Employees"
          value={employees}
          sub="Field agents"
          active={active}
        />
      </div>

      {/* Toolbar */}
      <div className="co-toolbar">
        <div className="co-search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="co-filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="All">All Roles</option>
          {roles.map((r) => <option key={r.Id} value={r.Name}>{r.Name}</option>)}
        </select>
        <select
          className="co-filter-select"
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
        >
          <option value="All">All Companies</option>
          {companies.map((c) => <option key={c.Id} value={String(c.Id)}>{c.Name}</option>)}
        </select>
        <select
          className="co-filter-select"
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
        >
          <option value="All">All Managers</option>
          {uniqueManagers.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{ margin: "0 20px 20px" }}>
        <div className="table-card" style={{ margin: 0 }}>
          {loading && (
            <div className="page-placeholder" style={{ minHeight: 200 }}>
              <span
                className="material-symbols-outlined page-placeholder-icon"
                style={{ animation: "spin 1s linear infinite" }}
              >
                progress_activity
              </span>
              <p>Loading users...</p>
            </div>
          )}
          {!loading && error && (
            <div className="page-placeholder" style={{ minHeight: 200 }}>
              <span
                className="material-symbols-outlined page-placeholder-icon"
                style={{ color: "#EF4444" }}
              >
                error
              </span>
              <p style={{ color: "#EF4444" }}>{error}</p>
            </div>
          )}
          {!loading && !error && (
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Manager</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => {
                  const rc = ROLE_COLORS[u.RoleName] || { bg: "#F1F5F9", color: "#64748B" };
                  return (
                    <tr key={u.Id} style={{ animation: `dashRowIn 0.35s ease ${i * 0.04}s both` }}>
                      <td>
                        <div className="avatar-cell">
                          <div
                            className="avatar avatar-circle"
                            style={{ background: getColor(u.Id) }}
                          >
                            {initials(u)}
                          </div>
                          <div>
                            <div className="cell-name">
                              {u.DisplayName
                                || `${u.FirstName || ""} ${u.LastName || ""}`.trim()
                                || "—"}
                            </div>
                            <div className="cell-sub">{u.Email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: rc.bg,
                            color: rc.color,
                            border: `1px solid ${rc.color}22`,
                          }}
                        >
                          {u.RoleName || "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {u.CompanyName || <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {u.ManagerName?.trim() || <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {u.PhoneNumber || <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td>
                        <span className={`badge ${u.IsActive ? "badge-success" : "badge-danger"}`}>
                          {u.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "#64748B" }}>
                        {u.CreatedAtUtc ? new Date(u.CreatedAtUtc).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <div className="action-btns">
                          <div
                            className="icon-btn"
                            title="Edit"
                            role="button"
                            tabIndex={0}
                            onClick={() => openEdit(u)}
                            onKeyDown={activateOnKey}
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </div>
                          <div
                            className="icon-btn icon-btn-danger"
                            title="Delete"
                            role="button"
                            tabIndex={0}
                            onClick={() => handleDelete(u.Id)}
                            onKeyDown={activateOnKey}
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="page-placeholder" style={{ minHeight: 150 }}>
              <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
              <p>No users match your search.</p>
            </div>
          )}

          {!loading && !error && (
            <div className="co-pagination">
              <span>Showing {filtered.length} of {users.length} users</span>
              <div className="co-page-btns">
                <button type="button" className="co-page-btn" disabled>‹</button>
                <button type="button" className="co-page-btn active">1</button>
                <button type="button" className="co-page-btn" disabled>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EEF2FF" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#1E3A8A", fontVariationSettings: "'FILL' 1" }}
                >
                  {editUser ? "edit" : "person_add"}
                </span>
              </div>
              <div>
                <div className="modal-title">{editUser ? "Edit User" : "Add New User"}</div>
                <div className="modal-sub">
                  {editUser ? `Editing ${editUser.Email}` : "Create a new platform user"}
                </div>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              {formError && (
                <div style={{
                  background: "#FEE2E2",
                  color: "#DC2626",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 13,
                  marginBottom: 12,
                }}
                >
                  {formError}
                </div>
              )}

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="user-first-name" className="form-label">First Name</label>
                  <input
                    id="user-first-name"
                    className="form-input"
                    placeholder="John"
                    value={form.firstName}
                    onChange={(e) => setF("firstName", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="user-last-name" className="form-label">Last Name</label>
                  <input
                    id="user-last-name"
                    className="form-input"
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={(e) => setF("lastName", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="user-email-address" className="form-label">
                  Email Address <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="user-email-address"
                  className="form-input"
                  type="email"
                  placeholder="user@company.com"
                  value={form.email}
                  onChange={(e) => setF("email", e.target.value)}
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="user-username" className="form-label">Username</label>
                  <input
                    id="user-username"
                    className="form-input"
                    placeholder="johndoe"
                    value={form.username}
                    onChange={(e) => setF("username", e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="user-phone" className="form-label">Phone</label>
                  <input
                    id="user-phone"
                    className="form-input"
                    placeholder="+91 9999999999"
                    value={form.phoneNumber}
                    onChange={(e) => setF("phoneNumber", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="user-password" className="form-label">
                  {editUser ? "New Password" : "Password"}
                  {" "}
                  {!editUser && <span style={{ color: "#EF4444" }}>*</span>}
                </label>
                <input
                  id="user-password"
                  className="form-input"
                  type="password"
                  placeholder={editUser ? "Leave blank to keep current" : "Min 6 characters"}
                  value={form.password}
                  onChange={(e) => setF("password", e.target.value)}
                />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="user-role" className="form-label">
                    Role <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <select
                    id="user-role"
                    className="form-select"
                    value={form.roleId}
                    onChange={(e) => setF("roleId", e.target.value)}
                  >
                    <option value="">Select role...</option>
                    {roles.map((r) => (
                      <option key={r.Id} value={r.Id}>{r.Name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="user-status" className="form-label">Status</label>
                  <select
                    id="user-status"
                    className="form-select"
                    value={form.isActive}
                    onChange={(e) => setF("isActive", Number(e.target.value))}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="user-company" className="form-label">Company</label>
                <select
                  id="user-company"
                  className="form-select"
                  value={form.companyId}
                  onChange={(e) => setF("companyId", e.target.value)}
                >
                  <option value="">Select company...</option>
                  {companies.map((c) => (
                    <option key={c.Id} value={c.Id}>{c.Name} {c.City ? `— ${c.City}` : ""}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="user-display-name" className="form-label">Display Name</label>
                <input
                  id="user-display-name"
                  className="form-input"
                  placeholder="John Doe"
                  value={form.displayName}
                  onChange={(e) => setF("displayName", e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={saving}
              >
                <span className="material-symbols-outlined">
                  {saving ? "progress_activity" : "save"}
                </span>
                {saving ? "Saving..." : saveLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete User?"
        message="This will permanently remove this user. This action cannot be undone."
        onConfirm={() => confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
