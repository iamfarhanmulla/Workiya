"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const AVATAR_COLORS = ["#8B5CF6","#10B981","#1E3A8A","#F59E0B","#EF4444","#06B6D4","#D946EF","#3B5FCF"];
const avatarColor = (id) => AVATAR_COLORS[id % AVATAR_COLORS.length];
const initials    = (e) => ((e.FirstName?.[0] || "") + (e.LastName?.[0] || "")).toUpperCase() || e.Email?.[0]?.toUpperCase() || "?";
const fullName    = (e) => `${e.FirstName || ""} ${e.LastName || ""}`.trim() || e.DisplayName || e.Email || "—";

function useCountUp(target, active, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal((1 - Math.pow(1 - p, 3)) * target);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [active, target, duration]);
  return val;
}

const StatCard = memo(function StatCard({ icon, bg, color, label, value, sub, index, active }) {
  const count = useCountUp(value, active);
  return (
    <div className="stat-card dash-anim-card" style={{ "--card-delay": `${index * 0.08}s` }}>
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: bg }}>
          <span className="material-symbols-outlined" style={{ color, fontVariationSettings: "'FILL' 1" }}>{icon}</span>
        </div>
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-val">{active ? Math.round(count).toLocaleString() : "0"}</p>
      <p className="stat-sub">{sub}</p>
    </div>
  );
});

const EMPTY_FORM = {
  firstName: "", lastName: "", middleName: "", email: "",
  phoneNumber: "", displayName: "", companyId: "", managerId: "", password: "", isActive: 1,
};

export default function EmployeesPage() {
  const [employees,  setEmployees]  = useState([]);
  const [companies,  setCompanies]  = useState([]);
  const [managers,   setManagers]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [active,     setActive]     = useState(false);
  const [search,     setSearch]     = useState("");
  const [compFilter, setCompFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal,  setShowModal]  = useState(false);
  const [viewModal,  setViewModal]  = useState(false);
  const [editEmp,    setEditEmp]    = useState(null);
  const [viewEmp,    setViewEmp]    = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const { toasts, showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/api/employees`);
      const json = await res.json();
      if (json.success) setEmployees(json.data);
      else setError("Failed to load employees.");
    } catch { setError("Cannot connect to server."); }
    finally { setLoading(false); setTimeout(() => setActive(true), 50); }
  }, []);

  const fetchDropdowns = useCallback(async () => {
    const [cRes, mRes] = await Promise.all([
      fetch(`${API}/api/users/companies`),
      fetch(`${API}/api/employees/managers-list`),
    ]);
    const [cJson, mJson] = await Promise.all([cRes.json(), mRes.json()]);
    if (cJson.success) setCompanies(cJson.data);
    if (mJson.success) setManagers(mJson.data);
  }, []);

  useEffect(() => { fetchEmployees(); fetchDropdowns(); }, [fetchEmployees, fetchDropdowns]);

  // ── Stats ──
  const total     = employees.length;
  const activeC   = employees.filter(e => e.IsActive).length;
  const inactiveC = employees.filter(e => !e.IsActive).length;
  const totalTasks = employees.reduce((s, e) => s + (e.TaskCount || 0), 0);

  // ── Filter ──
  const filtered = employees.filter(e => {
    const nm = `${fullName(e)} ${e.Email || ""}`.toLowerCase();
    const ms  = nm.includes(search.toLowerCase());
    const mc  = compFilter === "All" || String(e.CompanyId) === compFilter;
    const mst = statusFilter === "All" || (statusFilter === "Active" ? e.IsActive : !e.IsActive);
    return ms && mc && mst;
  });

  // ── Modals ──
  function openAdd() {
    setEditEmp(null); setForm(EMPTY_FORM); setFormError(""); setShowModal(true);
  }
  function openEdit(e) {
    setEditEmp(e);
    setForm({
      firstName:   e.FirstName   || "",
      lastName:    e.LastName    || "",
      middleName:  e.MiddleName  || "",
      email:       e.Email       || "",
      phoneNumber: e.PhoneNumber || "",
      displayName: e.DisplayName || "",
      companyId:   e.CompanyId   || "",
      managerId:   e.ManagerId   || "",
      password:    "",
      isActive:    e.IsActive ? 1 : 0,
    });
    setFormError(""); setShowModal(true);
  }
  function openView(e) { setViewEmp(e); setViewModal(true); }
  function closeModal() { setShowModal(false); setEditEmp(null); }
  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ── Save ──
  async function handleSave() {
    setFormError("");
    if (!form.email) return setFormError("Email is required.");
    if (!editEmp && !form.password) return setFormError("Password is required for new employee.");
    setSaving(true);
    try {
      const url    = editEmp ? `${API}/api/employees/${editEmp.Id}` : `${API}/api/employees`;
      const method = editEmp ? "PUT" : "POST";
      const body   = { ...form };
      if (editEmp && !body.password) delete body.password;
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) { setFormError(json.message || "Failed to save."); return; }
      showToast(editEmp ? "Employee updated successfully!" : "Employee created successfully!");
      closeModal(); fetchEmployees();
    } catch { setFormError("Cannot connect to server."); showToast("Cannot connect to server.", "error"); }
    finally  { setSaving(false); }
  }

  // ── Toggle active ──
  async function toggleActive(e) {
    try {
      await fetch(`${API}/api/employees/${e.Id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: e.IsActive ? 0 : 1 }),
      });
      showToast(e.IsActive ? "Employee deactivated." : "Employee activated.", e.IsActive ? "warning" : "success");
      fetchEmployees();
    } catch { showToast("Failed to update status.", "error"); }
  }

  // ── Delete ──
  async function handleDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    try {
      await fetch(`${API}/api/employees/${deleteTarget}`, { method: "DELETE" });
      showToast("Employee deleted successfully!", "success");
      fetchEmployees();
    } catch { showToast("Failed to delete employee.", "error"); }
    finally { setDeleteTarget(null); }
  }

  // task progress bar
  function ProgressBar({ done, total }) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 100 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#E2E8F0", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: pct === 100 ? "#10B981" : "#1E3A8A" }} />
        </div>
        <span style={{ fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>{done}/{total}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Employees</span>
          </div>
          <h1 className="page-hd-title">Employees</h1>
          <p className="page-hd-sub">Manage field employees and their assignments</p>
        </div>
        <div className="page-hd-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchEmployees}>
            <span className="material-symbols-outlined">refresh</span>Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <span className="material-symbols-outlined">add</span>Add Employee
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard index={0} icon="group"         bg="#EEF2FF" color="#1E3A8A" label="Total Employees" value={total}      sub="All employees"       active={active} />
        <StatCard index={1} icon="check_circle"  bg="#D1FAE5" color="#10B981" label="Active"          value={activeC}    sub="Currently active"    active={active} />
        <StatCard index={2} icon="cancel"        bg="#FEE2E2" color="#EF4444" label="Inactive"        value={inactiveC}  sub="Deactivated"         active={active} />
        <StatCard index={3} icon="task_alt"      bg="#EDE9FE" color="#8B5CF6" label="Total Tasks"     value={totalTasks} sub="Assigned across all" active={active} />
      </div>

      {/* Toolbar */}
      <div className="co-toolbar">
        <div className="co-search">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="co-filter-select" value={compFilter} onChange={e => setCompFilter(e.target.value)}>
          <option value="All">All Companies</option>
          {companies.map(c => <option key={c.Id} value={String(c.Id)}>{c.Name}</option>)}
        </select>
        <select className="co-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="All">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ margin: "0 20px 20px" }}>
        <div className="table-card" style={{ margin: 0 }}>
          {loading ? (
            <div className="page-placeholder" style={{ minHeight: 200 }}>
              <span className="material-symbols-outlined page-placeholder-icon" style={{ animation: "spin 1s linear infinite" }}>progress_activity</span>
              <p>Loading employees...</p>
            </div>
          ) : error ? (
            <div className="page-placeholder" style={{ minHeight: 200 }}>
              <span className="material-symbols-outlined page-placeholder-icon" style={{ color: "#EF4444" }}>error</span>
              <p style={{ color: "#EF4444" }}>{error}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Company</th>
                  <th>Manager</th>
                  <th>Phone</th>
                  <th>Tasks</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.Id} style={{ animation: `dashRowIn 0.35s ease ${i * 0.04}s both` }}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar avatar-circle" style={{ background: avatarColor(e.Id) }}>{initials(e)}</div>
                        <div>
                          <div className="cell-name">{fullName(e)}</div>
                          <div className="cell-sub">{e.Email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{e.CompanyName || <span style={{ color: "#94A3B8" }}>—</span>}</td>
                    <td style={{ fontSize: 13 }}>{e.ManagerName?.trim() || <span style={{ color: "#94A3B8" }}>—</span>}</td>
                    <td style={{ fontSize: 13 }}>{e.PhoneNumber || <span style={{ color: "#94A3B8" }}>—</span>}</td>
                    <td><ProgressBar done={e.TaskDone || 0} total={e.TaskCount || 0} /></td>
                    <td>
                      <span className={`badge ${e.IsActive ? "badge-success" : "badge-danger"}`}>
                        {e.IsActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#64748B" }}>
                      {e.CreatedAtUtc ? new Date(e.CreatedAtUtc).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div className="action-btns">
                        <div className="icon-btn" title="View" onClick={() => openView(e)}>
                          <span className="material-symbols-outlined">visibility</span>
                        </div>
                        <div className="icon-btn" title="Edit" onClick={() => openEdit(e)}>
                          <span className="material-symbols-outlined">edit</span>
                        </div>
                        <div
                          className={`icon-btn ${e.IsActive ? "icon-btn-warning" : "icon-btn-success"}`}
                          title={e.IsActive ? "Deactivate" : "Activate"}
                          onClick={() => toggleActive(e)}
                        >
                          <span className="material-symbols-outlined">{e.IsActive ? "block" : "check_circle"}</span>
                        </div>
                        <div className="icon-btn icon-btn-danger" title="Delete" onClick={() => handleDelete(e.Id)}>
                          <span className="material-symbols-outlined">delete</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="page-placeholder" style={{ minHeight: 150 }}>
              <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
              <p>No employees found.</p>
            </div>
          )}

          {!loading && !error && (
            <div className="co-pagination">
              <span>Showing {filtered.length} of {employees.length} employees</span>
              <div className="co-page-btns">
                <button className="co-page-btn" disabled>‹</button>
                <button className="co-page-btn active">1</button>
                <button className="co-page-btn" disabled>›</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EEF2FF" }}>
                <span className="material-symbols-outlined" style={{ color: "#1E3A8A", fontVariationSettings: "'FILL' 1" }}>
                  {editEmp ? "edit" : "person_add"}
                </span>
              </div>
              <div>
                <div className="modal-title">{editEmp ? "Edit Employee" : "Add New Employee"}</div>
                <div className="modal-sub">{editEmp ? `Editing ${editEmp.Email}` : "Create a new employee account"}</div>
              </div>
              <button className="modal-close" onClick={closeModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              {formError && (
                <div style={{ background: "#FEE2E2", color: "#DC2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
                  {formError}
                </div>
              )}

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input className="form-input" placeholder="John" value={form.firstName} onChange={e => setF("firstName", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input className="form-input" placeholder="Doe" value={form.lastName} onChange={e => setF("lastName", e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address <span style={{ color: "#EF4444" }}>*</span></label>
                <input className="form-input" type="email" placeholder="employee@company.com" value={form.email} onChange={e => setF("email", e.target.value)} />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+91 9999999999" value={form.phoneNumber} onChange={e => setF("phoneNumber", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {editEmp ? "New Password" : "Password"} {!editEmp && <span style={{ color: "#EF4444" }}>*</span>}
                  </label>
                  <input
                    className="form-input" type="password"
                    placeholder={editEmp ? "Leave blank to keep" : "Min 6 characters"}
                    value={form.password} onChange={e => setF("password", e.target.value)}
                  />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <select className="form-select" value={form.companyId} onChange={e => setF("companyId", e.target.value)}>
                    <option value="">Select company...</option>
                    {companies.map(c => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Manager</label>
                  <select className="form-select" value={form.managerId} onChange={e => setF("managerId", e.target.value)}>
                    <option value="">Select manager...</option>
                    {managers.map(m => <option key={m.Id} value={m.Id}>{m.Name} {m.CompanyName ? `(${m.CompanyName})` : ""}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="form-input" placeholder="John Doe" value={form.displayName} onChange={e => setF("displayName", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.isActive} onChange={e => setF("isActive", Number(e.target.value))}>
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <span className="material-symbols-outlined">{saving ? "progress_activity" : "save"}</span>
                {saving ? "Saving..." : (editEmp ? "Update Employee" : "Add Employee")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {viewModal && viewEmp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EEF2FF" }}>
                <span className="material-symbols-outlined" style={{ color: "#1E3A8A", fontVariationSettings: "'FILL' 1" }}>badge</span>
              </div>
              <div>
                <div className="modal-title">Employee Details</div>
                <div className="modal-sub">Full profile information</div>
              </div>
              <button className="modal-close" onClick={() => setViewModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: avatarColor(viewEmp.Id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>
                  {initials(viewEmp)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{fullName(viewEmp)}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{viewEmp.Email}</div>
                  <span className={`badge ${viewEmp.IsActive ? "badge-success" : "badge-danger"}`} style={{ marginTop: 4 }}>
                    {viewEmp.IsActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {[
                { label: "Company",   value: viewEmp.CompanyName         || "—" },
                { label: "Manager",   value: viewEmp.ManagerName?.trim() || "—" },
                { label: "Phone",     value: viewEmp.PhoneNumber          || "—" },
                { label: "Tasks",     value: `${viewEmp.TaskDone || 0} / ${viewEmp.TaskCount || 0} completed` },
                { label: "Joined",    value: viewEmp.CreatedAtUtc ? new Date(viewEmp.CreatedAtUtc).toLocaleDateString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                  <span style={{ color: "#94A3B8", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: "#0F172A", fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setViewModal(false)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setViewModal(false); openEdit(viewEmp); }}>
                <span className="material-symbols-outlined">edit</span>Edit Employee
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Employee?"
        message="This will permanently remove this employee. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
