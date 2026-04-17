"use client";

import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useState, useEffect, useRef, useCallback, memo } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const PLAN_STYLES = {
  ENTERPRISE: { bg: "#EDE9FE", color: "#8B5CF6" },
  PROFESSIONAL: { bg: "#EEF2FF", color: "#1E3A8A" },
  STARTUP: { bg: "#D1FAE5", color: "#10B981" },
};
const PLANS = ["STARTUP", "PROFESSIONAL", "ENTERPRISE"];

const AVATAR_COLORS = ["#8B5CF6", "#10B981", "#1E3A8A", "#F59E0B", "#EF4444", "#06B6D4", "#D946EF", "#3B5FCF"];
const avatarColor = (id) => AVATAR_COLORS[id % AVATAR_COLORS.length];
const initials = (name) => name ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?";

function useCountUp(target, active, duration = 1200) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
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
      <p className="stat-val">{active ? count.toLocaleString() : "0"}</p>
      <p className="stat-sub">{sub}</p>
    </div>
  );
});

const EMPTY_FORM = {
  name: "", key: "", contactEmail: "", contactPhone: "",
  address: "", city: "", country: "", plan: "STARTUP", isActive: 1,
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [editComp, setEditComp] = useState(null);
  const [viewComp, setViewComp] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { toasts, showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/companies`);
      const json = await res.json();
      if (json.success) setCompanies(json.data);
      else setError("Failed to load companies.");
    } catch { setError("Cannot connect to server."); }
    finally { setLoading(false); setTimeout(() => setActive(true), 50); }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  // ── Stats ──
  const total = companies.length;
  const activeC = companies.filter(c => c.IsActive).length;
  const inactiveC = companies.filter(c => !c.IsActive).length;
  const totalEmps = companies.reduce((s, c) => s + (c.EmployeeCount || 0), 0);

  // ── Filter ──
  const filtered = companies.filter(c => {
    const nm = `${c.Name || ""} ${c.City || ""} ${c.Country || ""}`.toLowerCase();
    const ms = nm.includes(search.toLowerCase());
    const mp = planFilter === "All" || c.Plan === planFilter;
    const mst = statusFilter === "All" || (statusFilter === "Active" ? c.IsActive : !c.IsActive);
    return ms && mp && mst;
  });

  // ── Modals ──
  function openAdd() {
    setEditComp(null); setForm(EMPTY_FORM); setFormError(""); setShowModal(true);
  }
  function openEdit(c) {
    setEditComp(c);
    setForm({
      name: c.Name || "",
      key: c.Key || "",
      contactEmail: c.ContactEmail || "",
      contactPhone: c.ContactPhone || "",
      address: c.Address || "",
      city: c.City || "",
      country: c.Country || "",
      plan: c.Plan || "STARTUP",
      isActive: c.IsActive ? 1 : 0,
    });
    setFormError(""); setShowModal(true);
  }
  function openView(c) { setViewComp(c); setViewModal(true); }
  function closeModal() { setShowModal(false); setEditComp(null); }
  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ── Save ──
  async function handleSave() {
    setFormError("");
    if (!form.name) return setFormError("Company name is required.");
    setSaving(true);
    try {
      const url = editComp ? `${API}/api/companies/${editComp.Id}` : `${API}/api/companies`;
      const method = editComp ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!json.success) { setFormError(json.message || "Failed to save."); return; }
      showToast(editComp ? "Company updated successfully!" : "Company created successfully!");
      closeModal(); fetchCompanies();
    } catch { setFormError("Cannot connect to server."); showToast("Cannot connect to server.", "error"); }
    finally { setSaving(false); }
  }

  // ── Toggle active ──
  async function toggleActive(c) {
    try {
      await fetch(`${API}/api/companies/${c.Id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: c.IsActive ? 0 : 1 }),
      });
      showToast(c.IsActive ? "Company deactivated." : "Company activated.", c.IsActive ? "warning" : "success");
      fetchCompanies();
    } catch { showToast("Failed to update status.", "error"); }
  }

  // ── Delete ──
  async function handleDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    try {
      await fetch(`${API}/api/companies/${deleteTarget}`, { method: "DELETE" });
      showToast("Company deleted successfully!", "success");
      fetchCompanies();
    } catch { showToast("Failed to delete company.", "error"); }
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
            <span className="breadcrumb-active">Companies</span>
          </div>
          <h1 className="page-hd-title">Companies</h1>
          <p className="page-hd-sub">Manage organizations on the WorKiya platform</p>
        </div>
        <div className="page-hd-actions">
          <button className="btn btn-outline btn-sm" onClick={fetchCompanies}>
            <span className="material-symbols-outlined">refresh</span>Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <span className="material-symbols-outlined">add</span>Add Company
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard index={0} icon="corporate_fare" bg="#EEF2FF" color="#1E3A8A" label="Total Companies" value={total} sub="All organizations" active={active} />
        <StatCard index={1} icon="check_circle" bg="#D1FAE5" color="#10B981" label="Active" value={activeC} sub="Currently active" active={active} />
        <StatCard index={2} icon="cancel" bg="#FEE2E2" color="#EF4444" label="Inactive" value={inactiveC} sub="Deactivated" active={active} />
        <StatCard index={3} icon="badge" bg="#EDE9FE" color="#8B5CF6" label="Total Employees" value={totalEmps} sub="Across all companies" active={active} />
      </div>

      {/* Toolbar */}
      <div className="co-toolbar">
        <div className="co-search">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="co-filter-select" value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
          <option value="All">All Plans</option>
          {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
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
              <p>Loading companies...</p>
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
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Plan</th>
                  <th>Managers</th>
                  <th>Employees</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const ps = PLAN_STYLES[c.Plan] || { bg: "#F1F5F9", color: "#64748B" };
                  return (
                    <tr key={c.Id} style={{ animation: `dashRowIn 0.35s ease ${i * 0.04}s both` }}>
                      <td>
                        <div className="avatar-cell">
                          <div className="avatar avatar-circle" style={{ background: avatarColor(c.Id) }}>{initials(c.Name)}</div>
                          <div>
                            <div className="cell-name">{c.Name}</div>
                            <div className="cell-sub">{c.Key}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13 }}>{c.ContactEmail || <span style={{ color: "#94A3B8" }}>—</span>}</div>
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>{c.ContactPhone || ""}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {(c.City || c.Country)
                          ? `${c.City || ""}${c.City && c.Country ? ", " : ""}${c.Country || ""}`
                          : <span style={{ color: "#94A3B8" }}>—</span>}
                      </td>
                      <td>
                        <span className="badge" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.color}22` }}>
                          {c.Plan || "—"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, fontWeight: 600, color: "#1E3A8A" }}>{c.EmployeeCount || 0}</td>
                      <td style={{ fontSize: 13, fontWeight: 600, color: "#8B5CF6" }}>{c.ManagerCount || 0}</td>
                      <td>
                        <span className={`badge ${c.IsActive ? "badge-success" : "badge-danger"}`}>
                          {c.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <div className="icon-btn" title="View" onClick={() => openView(c)}>
                            <span className="material-symbols-outlined">visibility</span>
                          </div>
                          <div className="icon-btn" title="Edit" onClick={() => openEdit(c)}>
                            <span className="material-symbols-outlined">edit</span>
                          </div>
                          <div
                            className={`icon-btn ${c.IsActive ? "icon-btn-warning" : "icon-btn-success"}`}
                            title={c.IsActive ? "Deactivate" : "Activate"}
                            onClick={() => toggleActive(c)}
                          >
                            <span className="material-symbols-outlined">{c.IsActive ? "block" : "check_circle"}</span>
                          </div>
                          <div className="icon-btn icon-btn-danger" title="Delete" onClick={() => handleDelete(c.Id)}>
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
              <p>No companies found.</p>
            </div>
          )}

          {!loading && !error && (
            <div className="co-pagination">
              <span>Showing {filtered.length} of {companies.length} companies</span>
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
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EEF2FF" }}>
                <span className="material-symbols-outlined" style={{ color: "#1E3A8A", fontVariationSettings: "'FILL' 1" }}>
                  {editComp ? "edit" : "corporate_fare"}
                </span>
              </div>
              <div>
                <div className="modal-title">{editComp ? "Edit Company" : "Add New Company"}</div>
                <div className="modal-sub">{editComp ? `Editing ${editComp.Name}` : "Register a new organization"}</div>
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
                  <label className="form-label">Company Name <span style={{ color: "#EF4444" }}>*</span></label>
                  <input className="form-input" placeholder="Acme Corp" value={form.name} onChange={e => setF("name", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Key / Slug</label>
                  <input className="form-input" placeholder="acme-corp (auto-generated)" value={form.key} onChange={e => setF("key", e.target.value)} />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Contact Email</label>
                  <input className="form-input" type="email" placeholder="contact@company.com" value={form.contactEmail} onChange={e => setF("contactEmail", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input className="form-input" placeholder="+91 9999999999" value={form.contactPhone} onChange={e => setF("contactPhone", e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input className="form-input" placeholder="123 Main Street" value={form.address} onChange={e => setF("address", e.target.value)} />
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="Mumbai" value={form.city} onChange={e => setF("city", e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <input className="form-input" placeholder="India" value={form.country} onChange={e => setF("country", e.target.value)} />
                </div>
              </div>

              <div className="form-row form-row-2">
                <div className="form-group">
                  <label className="form-label">Plan</label>
                  <select className="form-select" value={form.plan} onChange={e => setF("plan", e.target.value)}>
                    {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
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
                {saving ? "Saving..." : (editComp ? "Update Company" : "Add Company")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ── */}
      {viewModal && viewComp && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EEF2FF" }}>
                <span className="material-symbols-outlined" style={{ color: "#1E3A8A", fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
              </div>
              <div>
                <div className="modal-title">Company Details</div>
                <div className="modal-sub">Full organization information</div>
              </div>
              <button className="modal-close" onClick={() => setViewModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: avatarColor(viewComp.Id), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700 }}>
                  {initials(viewComp.Name)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#0F172A" }}>{viewComp.Name}</div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>{viewComp.Key}</div>
                  <span className={`badge ${viewComp.IsActive ? "badge-success" : "badge-danger"}`} style={{ marginTop: 4 }}>
                    {viewComp.IsActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              {[
                { label: "Plan", value: viewComp.Plan || "—" },
                { label: "Contact Email", value: viewComp.ContactEmail || "—" },
                { label: "Contact Phone", value: viewComp.ContactPhone || "—" },
                { label: "Address", value: viewComp.Address || "—" },
                { label: "City", value: viewComp.City || "—" },
                { label: "Country", value: viewComp.Country || "—" },
                { label: "Employees", value: viewComp.EmployeeCount || 0 },
                { label: "Managers", value: viewComp.ManagerCount || 0 },
                { label: "Created", value: viewComp.CreatedAtUtc ? new Date(viewComp.CreatedAtUtc).toLocaleDateString() : "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                  <span style={{ color: "#94A3B8", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: "#0F172A", fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline btn-sm" onClick={() => setViewModal(false)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => { setViewModal(false); openEdit(viewComp); }}>
                <span className="material-symbols-outlined">edit</span>Edit Company
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Company?"
        message="This will permanently remove this company. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
