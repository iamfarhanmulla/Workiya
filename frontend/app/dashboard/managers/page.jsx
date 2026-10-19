"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { api, getErrorMessage } from "@/lib/apiClient";

const AVATAR_COLORS = ["#8B5CF6","#10B981","#1E3A8A","#F59E0B","#EF4444","#06B6D4","#D946EF","#3B5FCF"];
function avatarColor(id) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(m) {
  const f = m.FirstName?.[0] || "";
  const l = m.LastName?.[0]  || "";
  return (f + l).toUpperCase() || m.Email?.[0]?.toUpperCase() || "?";
}
function fullName(m) {
  return `${m.FirstName || ""} ${m.LastName || ""}`.trim() || m.DisplayName || m.Email || "—";
}

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
  phoneNumber: "", displayName: "", companyId: "", password: "", isActive: 1,
};

export default function ManagersPage() {
  const [managers,   setManagers]   = useState([]);
  const [companies,  setCompanies]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [active,     setActive]     = useState(false);
  const [search,     setSearch]     = useState("");
  const [compFilter, setCompFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showModal,  setShowModal]  = useState(false);
  const [viewModal,  setViewModal]  = useState(false);
  const [editMgr,    setEditMgr]    = useState(null);
  const [viewMgr,    setViewMgr]    = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState("");
  const { toasts, showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchManagers = useCallback(async () => {
    try {
      setLoading(true);
      const res  = await api.get("/managers");
      const json = res.data;
      if (json.success) setManagers(json.data);
      else setError("Failed to load managers.");
    } catch (err) {
      setError(err.response ? "Failed to load managers." : "Cannot connect to server.");
    } finally {
      setLoading(false);
      setTimeout(() => setActive(true), 50);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res  = await api.get("/users/companies");
      const json = res.data;
      if (json.success) setCompanies(json.data);
    } catch {}
  }, []);

  useEffect(() => { fetchManagers(); fetchCompanies(); }, [fetchManagers, fetchCompanies]);

  // ── Stats ──
  const total    = managers.length;
  const activeC  = managers.filter(m => m.IsActive).length;
  const inactiveC = managers.filter(m => !m.IsActive).length;
  const totalEmp = managers.reduce((s, m) => s + (m.EmployeeCount || 0), 0);

  // ── Filter ──
  const filtered = managers.filter(m => {
    const nm = fullName(m).toLowerCase();
    const ms = nm.includes(search.toLowerCase()) || (m.Email || "").toLowerCase().includes(search.toLowerCase());
    const mc = compFilter === "All" || String(m.CompanyId) === compFilter;
    const mst = statusFilter === "All" || (statusFilter === "Active" ? m.IsActive : !m.IsActive);
    return ms && mc && mst;
  });

  // ── Modal helpers ──
  function openAdd() {
    setEditMgr(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowModal(true);
  }
  function openEdit(m) {
    setEditMgr(m);
    setForm({
      firstName:   m.FirstName   || "",
      lastName:    m.LastName    || "",
      middleName:  m.MiddleName  || "",
      email:       m.Email       || "",
      phoneNumber: m.PhoneNumber || "",
      displayName: m.DisplayName || "",
      companyId:   m.CompanyId   || "",
      password:    "",
      isActive:    m.IsActive ? 1 : 0,
    });
    setFormError("");
    setShowModal(true);
  }
  function openView(m) { setViewMgr(m); setViewModal(true); }
  function closeModal() { setShowModal(false); setEditMgr(null); }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ── Save ──
  async function handleSave() {
    setFormError("");
    if (!form.email)  return setFormError("Email is required.");
    if (!editMgr && !form.password) return setFormError("Password is required for new manager.");

    setSaving(true);
    try {
      const body   = { ...form };
      if (editMgr && !body.password) delete body.password;

      const res  = editMgr ? await api.put(`/managers/${editMgr.Id}`, body) : await api.post("/managers", body);
      const json = res.data;
      if (!json.success) { setFormError(json.message || "Failed to save."); return; }
      showToast(editMgr ? "Manager updated successfully!" : "Manager created successfully!");
      closeModal();
      fetchManagers();
    } catch (err) {
      const msg = getErrorMessage(err, "Failed to save.");
      setFormError(msg);
      if (!err.response) showToast(msg, "error");
    }
    finally  { setSaving(false); }
  }

  // ── Toggle active ──
  async function toggleActive(m) {
    try {
      await api.patch(`/managers/${m.Id}/status`, { isActive: m.IsActive ? 0 : 1 });
      showToast(m.IsActive ? "Manager deactivated." : "Manager activated.", m.IsActive ? "warning" : "success");
      fetchManagers();
    } catch { showToast("Failed to update status.", "error"); }
  }

  // ── Delete ──
  async function handleDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    try {
      await api.delete(`/managers/${deleteTarget}`);
      showToast("Manager deleted successfully!", "success");
      fetchManagers();
    } catch { showToast("Failed to delete manager.", "error"); }
    finally { setDeleteTarget(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Managers</span>
          </div>
          <h1 className="page-hd-title">Managers</h1>
          <p className="page-hd-sub">Manage company managers and their field teams</p>
        </div>
        <div className="page-hd-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchManagers}>
            <span className="material-symbols-outlined">refresh</span>
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <span className="material-symbols-outlined">add</span>
            Add Manager
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard index={0} icon="manage_accounts" bg="#EDE9FE" color="#8B5CF6" label="Total Managers"  value={total}    sub="Across all companies"   active={active} />
        <StatCard index={1} icon="check_circle"    bg="#D1FAE5" color="#10B981" label="Active"          value={activeC}  sub="Currently operational"  active={active} />
        <StatCard index={2} icon="cancel"          bg="#FEE2E2" color="#EF4444" label="Inactive"        value={inactiveC} sub="Deactivated managers"  active={active} />
        <StatCard index={3} icon="group"           bg="#EEF2FF" color="#1E3A8A" label="Total Employees" value={totalEmp} sub="Under all managers"      active={active} />
      </div>

      {/* Toolbar */}
      <div className="co-toolbar">
        <div className="co-search">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search managers..." value={search} onChange={e => setSearch(e.target.value)} />
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
              <p>Loading managers...</p>
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
                  <th>Manager</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Employees</th>
                  <th>Tasks</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.Id} style={{ animation: `dashRowIn 0.35s ease ${i * 0.04}s both` }}>
                    <td>
                      <div className="avatar-cell">
                        <div className="avatar avatar-circle" style={{ background: avatarColor(m.Id) }}>{initials(m)}</div>
                        <div>
                          <div className="cell-name">{fullName(m)}</div>
                          <div className="cell-sub">{m.Email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{m.CompanyName || <span style={{ color: "#94A3B8" }}>—</span>}</td>
                    <td style={{ fontSize: 13 }}>{m.PhoneNumber || <span style={{ color: "#94A3B8" }}>—</span>}</td>
                    <td><strong>{m.EmployeeCount || 0}</strong></td>
                    <td><strong>{m.TaskCount || 0}</strong></td>
                    <td>
                      <span className={`badge ${m.IsActive ? "badge-success" : "badge-danger"}`}>
                        {m.IsActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "#64748B" }}>
                      {m.CreatedAtUtc ? new Date(m.CreatedAtUtc).toLocaleDateString() : "—"}
                    </td>
                    <td>
                      <div className="action-btns">
                        {/* View */}
                        <div className="icon-btn" title="View" onClick={() => openView(m)}>
                          <span className="material-symbols-outlined">visibility</span>
                        </div>
                        {/* Edit */}
                        <div className="icon-btn" title="Edit" onClick={() => openEdit(m)}>
                          <span className="material-symbols-outlined">edit</span>
                        </div>
                        {/* Active / Inactive toggle */}
                        <div
                          className={`icon-btn ${m.IsActive ? "icon-btn-warning" : "icon-btn-success"}`}
                          title={m.IsActive ? "Deactivate" : "Activate"}
                          onClick={() => toggleActive(m)}
                        >
                          <span className="material-symbols-outlined">{m.IsActive ? "block" : "check_circle"}</span>
                        </div>
                        {/* Delete */}
                        <div className="icon-btn icon-btn-danger" title="Delete" onClick={() => handleDelete(m.Id)}>
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
              <p>No managers found.</p>
            </div>
          )}

          {!loading && !error && (
            <div className="co-pagination">
              <span>Showing {filtered.length} of {managers.length} managers</span>
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
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EDE9FE" }}>
                <span className="material-symbols-outlined" style={{ color: "#8B5CF6", fontVariationSettings: "'FILL' 1" }}>
                  {editMgr ? "edit" : "manage_accounts"}
                </span>
              </div>
              <div>
                <div className="modal-title">{editMgr ? "Edit Manager" : "Add New Manager"}</div>
                <div className="modal-sub">{editMgr ? `Editing ${editMgr.Email}` : "Create a new manager account"}</div>
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
                <input className="form-input" type="email" placeholder="manager@company.com" value={form.email} onChange={e => setF("email", e.target.value)} />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+91 9999999999" value={form.phoneNumber} onChange={e => setF("phoneNumber", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    {editMgr ? "New Password" : "Password"} {!editMgr && <span style={{ color: "#EF4444" }}>*</span>}
                  </label>
                  <input
                    className="form-input" type="password"
                    placeholder={editMgr ? "Leave blank to keep" : "Min 6 characters"}
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
                {saving ? "Saving..." : (editMgr ? "Update Manager" : "Add Manager")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {viewModal && viewMgr && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EDE9FE" }}>
                <span className="material-symbols-outlined" style={{ color: "#8B5CF6", fontVariationSettings: "'FILL' 1" }}>person</span>
              </div>
              <div>
                <div className="modal-title">Manager Details</div>
                <div className="modal-sub">Full profile information</div>
              </div>
              <button className="modal-close" onClick={() => setViewModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              {/* Avatar */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: avatarColor(viewMgr.Id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>
                  {initials(viewMgr)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{fullName(viewMgr)}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{viewMgr.Email}</div>
                  <span className={`badge ${viewMgr.IsActive ? "badge-success" : "badge-danger"}`} style={{ marginTop: 4 }}>
                    {viewMgr.IsActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {/* Details grid */}
              {[
                { label: "Company",   value: viewMgr.CompanyName || "—" },
                { label: "Phone",     value: viewMgr.PhoneNumber  || "—" },
                { label: "Employees", value: viewMgr.EmployeeCount || 0 },
                { label: "Tasks",     value: viewMgr.TaskCount || 0 },
                { label: "Joined",    value: viewMgr.CreatedAtUtc ? new Date(viewMgr.CreatedAtUtc).toLocaleDateString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                  <span style={{ color: "#94A3B8", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: "#0F172A", fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setViewModal(false)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setViewModal(false); openEdit(viewMgr); }}>
                <span className="material-symbols-outlined">edit</span>
                Edit Manager
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Manager?"
        message="This will permanently remove this manager. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
