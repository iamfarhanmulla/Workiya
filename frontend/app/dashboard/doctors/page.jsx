"use client";

import { useState, useEffect, useRef } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { api, getErrorMessage } from "@/lib/apiClient";
import activateOnKey from "@/app/dashboard/_utils/activateOnKey";

const SPECIALIZATIONS = [
  "Cardiologist", "General Physician", "Neurologist",
  "Oncologist", "Dermatologist", "Surgeon", "Orthopedist",
  "Psychiatrist", "Pediatrician", "Radiologist", "Other",
];

const SPEC_COLORS = {
  Cardiologist: { bg: "#FEE2E2", color: "#DC2626" },
  "General Physician": { bg: "#D1FAE5", color: "#059669" },
  Neurologist: { bg: "#EDE9FE", color: "#7C3AED" },
  Oncologist: { bg: "#FEF3C7", color: "#D97706" },
  Dermatologist: { bg: "#FCE7F3", color: "#DB2777" },
  Surgeon: { bg: "#DBEAFE", color: "#2563EB" },
  Orthopedist: { bg: "#D1FAE5", color: "#047857" },
  Psychiatrist: { bg: "#E0E7FF", color: "#4338CA" },
  Pediatrician: { bg: "#FEF9C3", color: "#CA8A04" },
  Radiologist: { bg: "#CFFAFE", color: "#0891B2" },
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

function StatCard({
  icon, bg, color, label, value, sub, index, active, isFloat,
}) {
  const count = useCountUp(value, active);
  const fmt = (n) => (isFloat ? n.toFixed(0) : Math.round(n).toLocaleString());
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
      <p className="stat-val">{active ? fmt(count) : "0"}</p>
      <p className="stat-sub">{sub}</p>
    </div>
  );
}

const BLANK = {
  name: "",
  specialization: "",
  hospitalName: "",
  phoneNumber: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "",
  latitude: "",
  longitude: "",
  notes: "",
  companyId: "",
  isActive: true,
};

export default function DoctorsPage() {
  const { toasts, showToast } = useToast();
  const [doctors, setDoctors] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("grid");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const [viewDoctor, setViewDoctor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statsActive, setStatsActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStatsActive(true), 60);
    return () => clearTimeout(t);
  }, []);

  async function load() {
    setLoading(true);
    try {
      // Only SUPER_ADMIN may list companies; for other roles the dropdown stays empty
      // and the API files the doctor under the user's own company.
      const [dRes, cRes] = await Promise.all([
        api.get("/doctors"),
        api.get("/companies").catch(() => null),
      ]);
      const dData = dRes.data;
      const cData = cRes?.data;
      if (dData.success) setDoctors(dData.data);
      if (cData?.success) setCompanies(cData.data);
    } catch {
      showToast("Failed to load data.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load on mount
    load();
    // Run once on mount: load() is re-created on every render, so listing it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, []);

  const filtered = doctors.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || d.Name?.toLowerCase().includes(q)
      || d.HospitalName?.toLowerCase().includes(q)
      || d.City?.toLowerCase().includes(q)
      || d.Specialization?.toLowerCase().includes(q);
    const matchSpec = specFilter === "all" || d.Specialization === specFilter;
    const matchStatus = statusFilter === "all"
      || (statusFilter === "active" && d.IsActive)
      || (statusFilter === "inactive" && !d.IsActive);
    return matchSearch && matchSpec && matchStatus;
  });

  const totalDoctors = doctors.length;
  const activeDoctors = doctors.filter((d) => d.IsActive).length;
  const inactiveDoctors = doctors.filter((d) => !d.IsActive).length;
  const citiesCovered = new Set(doctors.map((d) => d.City).filter(Boolean)).size;

  function openAdd() {
    setEditTarget(null);
    setForm(BLANK);
    setModalOpen(true);
  }

  function openEdit(doc) {
    setEditTarget(doc);
    setForm({
      name: doc.Name || "",
      specialization: doc.Specialization || "",
      hospitalName: doc.HospitalName || "",
      phoneNumber: doc.PhoneNumber || "",
      email: doc.Email || "",
      address: doc.Address || "",
      city: doc.City || "",
      state: doc.State || "",
      country: doc.Country || "",
      latitude: doc.Latitude || "",
      longitude: doc.Longitude || "",
      notes: doc.Notes || "",
      companyId: doc.CompanyId || "",
      isActive: doc.IsActive,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showToast("Doctor name is required.", "warning");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        isActive: form.isActive ? 1 : 0,
      };
      const res = editTarget
        ? await api.put(`/doctors/${editTarget.Id}`, body)
        : await api.post("/doctors", body);
      const { data } = res;
      if (!data.success) {
        showToast(data.message || "Save failed.", "error");
        return;
      }
      showToast(
        editTarget ? "Doctor updated successfully." : "Doctor created successfully.",
        "success",
      );
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Save failed."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(doc) {
    try {
      const res = await api.patch(`/doctors/${doc.Id}/status`, { isActive: doc.IsActive ? 0 : 1 });
      const { data } = res;
      if (!data.success) {
        showToast(data.message || "Update failed.", "error");
        return;
      }
      showToast(doc.IsActive ? "Doctor deactivated." : "Doctor activated.", "success");
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Update failed."), "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/doctors/${deleteTarget}`);
      const { data } = res;
      if (!data.success) {
        showToast(data.message || "Delete failed.", "error");
        return;
      }
      showToast("Doctor deleted.", "success");
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Delete failed."), "error");
    }
  }

  const specCol = (spec) => SPEC_COLORS[spec] || { bg: "#F1F5F9", color: "#475569" };

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="doc-page">
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Doctor"
        message="This will permanently remove the doctor record. This action cannot be undone."
        onConfirm={() => confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Page Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Doctors</span>
          </div>
          <h1 className="page-hd-title">Doctors</h1>
          <p className="page-hd-sub">Manage doctor profiles, locations, and visit assignments</p>
        </div>
        <div className="page-hd-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
            <span className="material-symbols-outlined">add</span>
            Add Doctor
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard
          icon="medical_services"
          bg="#ECFEFF"
          color="#06B6D4"
          label="Total Doctors"
          value={totalDoctors}
          sub="Across all companies"
          index={0}
          active={statsActive}
        />
        <StatCard
          icon="check_circle"
          bg="#D1FAE5"
          color="#10B981"
          label="Active Doctors"
          value={activeDoctors}
          sub="Currently active"
          index={1}
          active={statsActive}
        />
        <StatCard
          icon="cancel"
          bg="#FEE2E2"
          color="#EF4444"
          label="Inactive Doctors"
          value={inactiveDoctors}
          sub="Deactivated records"
          index={2}
          active={statsActive}
        />
        <StatCard
          icon="location_city"
          bg="#EEF2FF"
          color="#6366F1"
          label="Cities Covered"
          value={citiesCovered}
          sub="Unique cities"
          index={3}
          active={statsActive}
        />
      </div>

      {/* Toolbar */}
      <div className="co-toolbar">
        <div className="co-search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search doctors, hospitals, cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="co-filter-select"
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
        >
          <option value="all">All Specializations</option>
          {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="co-filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="tasks-view-btns" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className={`tasks-view-btn${view === "grid" ? " active" : ""}`}
            onClick={() => setView("grid")}
          >
            <span className="material-symbols-outlined">grid_view</span>
          </button>
          <button
            type="button"
            className={`tasks-view-btn${view === "list" ? " active" : ""}`}
            onClick={() => setView("list")}
          >
            <span className="material-symbols-outlined">table_rows</span>
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="page-placeholder">
          <span
            className="material-symbols-outlined page-placeholder-icon"
            style={{ animation: "spin 1s linear infinite" }}
          >
            progress_activity
          </span>
          <p>Loading doctors...</p>
        </div>
      )}

      {/* Grid View */}
      {!loading && view === "grid" && (
        <div className="doc-grid">
          {filtered.map((doc, i) => {
            const sc = specCol(doc.Specialization);
            return (
              <div key={doc.Id} className="doc-card" style={{ "--doc-du": `${i * 0.06}s` }}>
                {/* Map preview strip */}
                <div className="doc-map-preview">
                  <div className="doc-map-grid" />
                  <div className="doc-map-pin">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      location_on
                    </span>
                  </div>
                  {/* Status badge */}
                  <div style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 20,
                    letterSpacing: "0.5px",
                    background: doc.IsActive ? "#D1FAE5" : "#FEE2E2",
                    color: doc.IsActive ? "#059669" : "#DC2626",
                  }}
                  >
                    {doc.IsActive ? "ACTIVE" : "INACTIVE"}
                  </div>
                </div>

                <div className="doc-card-top">
                  <div className="doc-avatar">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      stethoscope
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="doc-name">{doc.Name}</div>
                    <div style={{
                      display: "inline-block",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 20,
                      marginTop: 2,
                      background: sc.bg,
                      color: sc.color,
                    }}
                    >
                      {doc.Specialization || "—"}
                    </div>
                  </div>
                </div>

                {doc.HospitalName && (
                  <div className="doc-info-row">
                    <span className="material-symbols-outlined">local_hospital</span>
                    {doc.HospitalName}
                  </div>
                )}
                {doc.City && (
                  <div className="doc-info-row">
                    <span className="material-symbols-outlined">location_on</span>
                    {[doc.City, doc.State, doc.Country].filter(Boolean).join(", ")}
                  </div>
                )}
                {doc.PhoneNumber && (
                  <div className="doc-info-row">
                    <span className="material-symbols-outlined">call</span>
                    {doc.PhoneNumber}
                  </div>
                )}
                {doc.CompanyName && (
                  <div className="doc-info-row">
                    <span className="material-symbols-outlined">business</span>
                    {doc.CompanyName}
                  </div>
                )}

                <div className="doc-card-footer">
                  <button
                    type="button"
                    onClick={() => toggleActive(doc)}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "4px 10px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      background: doc.IsActive ? "#FEE2E2" : "#D1FAE5",
                      color: doc.IsActive ? "#DC2626" : "#059669",
                    }}
                  >
                    {doc.IsActive ? "Deactivate" : "Activate"}
                  </button>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div
                      className="icon-btn"
                      title="View"
                      role="button"
                      tabIndex={0}
                      onClick={() => setViewDoctor(doc)}
                      onKeyDown={activateOnKey}
                    >
                      <span className="material-symbols-outlined">visibility</span>
                    </div>
                    <div
                      className="icon-btn"
                      title="Edit"
                      role="button"
                      tabIndex={0}
                      onClick={() => openEdit(doc)}
                      onKeyDown={activateOnKey}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </div>
                    <div
                      className="icon-btn icon-btn-danger"
                      title="Delete"
                      role="button"
                      tabIndex={0}
                      onClick={() => setDeleteTarget(doc.Id)}
                      onKeyDown={activateOnKey}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="page-placeholder" style={{ gridColumn: "1/-1", minHeight: 200 }}>
              <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
              <p>No doctors match your search.</p>
            </div>
          )}
        </div>
      )}

      {/* List View */}
      {!loading && view === "list" && (
        <div style={{ margin: "0 20px 20px" }}>
          <div className="table-card" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Specialization</th>
                  <th>Hospital</th>
                  <th>Location</th>
                  <th>Phone</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => {
                  const sc = specCol(doc.Specialization);
                  return (
                    <tr key={doc.Id} style={{ animation: `docFadeUp 0.3s ease ${i * 0.04}s both` }}>
                      <td>
                        <div className="avatar-cell">
                          <div
                            className="avatar avatar-circle"
                            style={{ background: "linear-gradient(135deg,#06B6D4,#6366F1)" }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: 14,
                                color: "#fff",
                                fontVariationSettings: "'FILL' 1",
                              }}
                            >
                              stethoscope
                            </span>
                          </div>
                          <div>
                            <div className="cell-name">{doc.Name}</div>
                            {doc.Email && <div className="cell-sub">{doc.Email}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: sc.bg,
                          color: sc.color,
                        }}
                        >
                          {doc.Specialization || "—"}
                        </span>
                      </td>
                      <td>{doc.HospitalName || "—"}</td>
                      <td>{[doc.City, doc.Country].filter(Boolean).join(", ") || "—"}</td>
                      <td>{doc.PhoneNumber || "—"}</td>
                      <td>{doc.CompanyName || "—"}</td>
                      <td>
                        <span
                          className={`badge ${
                            doc.IsActive ? "badge-active" : "badge-inactive"
                          }`}
                        >
                          {doc.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <div
                            className="icon-btn"
                            title="View"
                            role="button"
                            tabIndex={0}
                            onClick={() => setViewDoctor(doc)}
                            onKeyDown={activateOnKey}
                          >
                            <span className="material-symbols-outlined">visibility</span>
                          </div>
                          <div
                            className="icon-btn"
                            title="Edit"
                            role="button"
                            tabIndex={0}
                            onClick={() => openEdit(doc)}
                            onKeyDown={activateOnKey}
                          >
                            <span className="material-symbols-outlined">edit</span>
                          </div>
                          <div
                            className="icon-btn"
                            title={doc.IsActive ? "Deactivate" : "Activate"}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleActive(doc)}
                            onKeyDown={activateOnKey}
                          >
                            <span className="material-symbols-outlined">
                              {doc.IsActive ? "toggle_on" : "toggle_off"}
                            </span>
                          </div>
                          <div
                            className="icon-btn icon-btn-danger"
                            title="Delete"
                            role="button"
                            tabIndex={0}
                            onClick={() => setDeleteTarget(doc.Id)}
                            onKeyDown={activateOnKey}
                          >
                            <span className="material-symbols-outlined">delete</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="page-placeholder" style={{ minHeight: 140 }}>
                        <span className="material-symbols-outlined page-placeholder-icon">
                          search_off
                        </span>
                        <p>No doctors found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div className="modal-header-icon">
                <span className="material-symbols-outlined">medical_services</span>
              </div>
              <div>
                <div className="modal-title">{editTarget ? "Edit Doctor" : "Add New Doctor"}</div>
                <div className="modal-sub">
                  Doctor details will be available for task assignment
                </div>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="doctor-doctor-name" className="form-label">
                    Doctor Name <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    id="doctor-doctor-name"
                    className="form-input"
                    placeholder="Dr. Rajesh Mehta"
                    value={form.name}
                    onChange={f("name")}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="doctor-specialization" className="form-label">
                    Specialization
                  </label>
                  <select
                    id="doctor-specialization"
                    className="form-select"
                    value={form.specialization}
                    onChange={f("specialization")}
                  >
                    <option value="">Select Specialization</option>
                    {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="doctor-hospital-clinic-name" className="form-label">
                  Hospital / Clinic Name
                </label>
                <input
                  id="doctor-hospital-clinic-name"
                  className="form-input"
                  placeholder="Lilavati Hospital"
                  value={form.hospitalName}
                  onChange={f("hospitalName")}
                />
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="doctor-phone-number" className="form-label">Phone Number</label>
                  <input
                    id="doctor-phone-number"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={form.phoneNumber}
                    onChange={f("phoneNumber")}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="doctor-email" className="form-label">Email</label>
                  <input
                    id="doctor-email"
                    className="form-input"
                    type="email"
                    placeholder="dr@hospital.com"
                    value={form.email}
                    onChange={f("email")}
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="doctor-full-address" className="form-label">Full Address</label>
                <input
                  id="doctor-full-address"
                  className="form-input"
                  placeholder="Building, Street, Area"
                  value={form.address}
                  onChange={f("address")}
                />
              </div>
              <div className="form-row form-row-3">
                <div className="form-group">
                  <label htmlFor="doctor-city" className="form-label">City</label>
                  <input
                    id="doctor-city"
                    className="form-input"
                    placeholder="Mumbai"
                    value={form.city}
                    onChange={f("city")}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="doctor-state" className="form-label">State</label>
                  <input
                    id="doctor-state"
                    className="form-input"
                    placeholder="Maharashtra"
                    value={form.state}
                    onChange={f("state")}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="doctor-country" className="form-label">Country</label>
                  <input
                    id="doctor-country"
                    className="form-input"
                    placeholder="India"
                    value={form.country}
                    onChange={f("country")}
                  />
                </div>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="doctor-latitude" className="form-label">Latitude</label>
                  <input
                    id="doctor-latitude"
                    className="form-input"
                    placeholder="19.0596"
                    value={form.latitude}
                    onChange={f("latitude")}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="doctor-longitude" className="form-label">Longitude</label>
                  <input
                    id="doctor-longitude"
                    className="form-input"
                    placeholder="72.8295"
                    value={form.longitude}
                    onChange={f("longitude")}
                  />
                </div>
              </div>
              {companies.length > 0 && (
                <div className="form-group">
                  <label htmlFor="doctor-company" className="form-label">Company</label>
                  <select
                    id="doctor-company"
                    className="form-select"
                    value={form.companyId}
                    onChange={f("companyId")}
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => <option key={c.Id} value={c.Id}>{c.Name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label htmlFor="doctor-notes-for-employee" className="form-label">
                  Notes for Employee
                </label>
                <textarea
                  id="doctor-notes-for-employee"
                  className="form-textarea"
                  rows={3}
                  placeholder="Visit between 10am–12pm. Ask at reception, 2nd floor..."
                  value={form.notes}
                  onChange={f("notes")}
                />
              </div>
              <div className="form-group">
                <label
                  htmlFor="doctor-is-active"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <input
                    id="doctor-is-active"
                    type="checkbox"
                    checked={!!form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={saving}
              >
                <span className="material-symbols-outlined">save</span>
                {saving ? "Saving..." : "Save Doctor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewDoctor && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setViewDoctor(null)}
        >
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div
                className="modal-header-icon"
                style={{ background: "linear-gradient(135deg,#06B6D4,#6366F1)" }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#fff", fontVariationSettings: "'FILL' 1" }}
                >
                  stethoscope
                </span>
              </div>
              <div>
                <div className="modal-title">{viewDoctor.Name}</div>
                <div className="modal-sub">{viewDoctor.Specialization || "Doctor"}</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setViewDoctor(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div
              className="modal-body"
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              {[
                { icon: "local_hospital", label: "Hospital", val: viewDoctor.HospitalName },
                { icon: "call", label: "Phone", val: viewDoctor.PhoneNumber },
                { icon: "mail", label: "Email", val: viewDoctor.Email },
                { icon: "home", label: "Address", val: viewDoctor.Address },
                {
                  icon: "location_on",
                  label: "Location",
                  val: [viewDoctor.City, viewDoctor.State, viewDoctor.Country]
                    .filter(Boolean)
                    .join(", "),
                },
                {
                  icon: "explore",
                  label: "Coordinates",
                  val: viewDoctor.Latitude
                    ? `${viewDoctor.Latitude}, ${viewDoctor.Longitude}`
                    : null,
                },
                { icon: "business", label: "Company", val: viewDoctor.CompanyName },
                { icon: "notes", label: "Notes", val: viewDoctor.Notes },
              ].filter((r) => r.val).map((row) => (
                <div key={row.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 16, color: "#6366F1", marginTop: 1, flexShrink: 0,
                    }}
                  >
                    {row.icon}
                  </span>
                  <div>
                    <div style={{
                      fontSize: 11,
                      color: "#94A3B8",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                    >
                      {row.label}
                    </div>
                    <div style={{
                      fontSize: 13, color: "var(--ds-text)", fontWeight: 500, marginTop: 1,
                    }}
                    >
                      {row.val}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 20,
                  background: viewDoctor.IsActive ? "#D1FAE5" : "#FEE2E2",
                  color: viewDoctor.IsActive ? "#059669" : "#DC2626",
                }}
                >
                  {viewDoctor.IsActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setViewDoctor(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setViewDoctor(null);
                  openEdit(viewDoctor);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
                Edit Doctor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
