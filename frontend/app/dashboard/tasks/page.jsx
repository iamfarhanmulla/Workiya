"use client";

import { useState, useEffect } from "react";
import { useToast, ToastContainer } from "@/components/Toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { api, getErrorMessage } from "@/lib/apiClient";
import activateOnKey from "@/app/dashboard/_utils/activateOnKey";

const STATUSES = ["Pending", "InProgress", "Completed", "Cancelled"];

const COL_CFG = {
  Pending: {
    label: "PENDING",
    dot: "#F59E0B",
    countBg: "#FEF3C7",
    countColor: "#D97706",
    border: "#FDE68A",
    icon: "pending_actions",
  },
  InProgress: {
    label: "IN PROGRESS",
    dot: "#6366F1",
    countBg: "#EEF2FF",
    countColor: "#4F46E5",
    border: "#C7D2FE",
    icon: "sync",
  },
  Completed: {
    label: "COMPLETED",
    dot: "#10B981",
    countBg: "#D1FAE5",
    countColor: "#059669",
    border: "#6EE7B7",
    icon: "check_circle",
  },
  Cancelled: {
    label: "CANCELLED",
    dot: "#94A3B8",
    countBg: "#F1F5F9",
    countColor: "#64748B",
    border: "#CBD5E1",
    icon: "cancel",
  },
};

const PRIORITY_STYLE = {
  High: { bg: "#FEE2E2", color: "#DC2626" },
  Medium: { bg: "#FEF3C7", color: "#D97706" },
  Low: { bg: "#D1FAE5", color: "#059669" },
};

const BLANK = {
  title: "", description: "", doctorId: "", assignedTo: "", priority: "Medium", dueDate: "",
};

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase()
    .slice(0, 2) || "?";
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isPast(iso) {
  return iso && new Date(iso) < new Date();
}

export default function TasksPage() {
  const { toasts, showToast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("kanban");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriority] = useState("all");
  const [employeeFilter, setEmployee] = useState("all");
  const [doctorFilter, setDoctor] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTask, setViewTask] = useState(null);

  async function load() {
    setLoading(true);
    try {
      // EMPLOYEE may not list employees; the assignee dropdown is only for staff anyway.
      const [tRes, dRes, eRes] = await Promise.all([
        api.get("/tasks"),
        api.get("/doctors"),
        api.get("/employees").catch(() => null),
      ]);
      const [tData, dData, eData] = [tRes.data, dRes.data, eRes?.data];
      if (tData.success) setTasks(tData.data);
      if (dData.success) setDoctors(dData.data);
      if (eData?.success) setEmployees(eData.data);
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

  const filtered = tasks.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || t.Title?.toLowerCase().includes(q)
      || t.DoctorName?.toLowerCase().includes(q)
      || t.AssigneeName?.toLowerCase().includes(q);
    const matchPriority = priorityFilter === "all" || t.Priority === priorityFilter;
    const matchEmployee = employeeFilter === "all" || String(t.AssignedTo) === employeeFilter;
    const matchDoctor = doctorFilter === "all" || String(t.DoctorId) === doctorFilter;
    return matchSearch && matchPriority && matchEmployee && matchDoctor;
  });

  const byStatus = (s) => filtered.filter((t) => t.Status === s);

  const total = tasks.length;
  const pending = tasks.filter((t) => t.Status === "Pending").length;
  const inProg = tasks.filter((t) => t.Status === "InProgress").length;
  const completed = tasks.filter((t) => t.Status === "Completed").length;

  function openAdd(defaultStatus) {
    setEditTarget(null);
    setForm({ ...BLANK, _defaultStatus: defaultStatus || "Pending" });
    setModalOpen(true);
  }

  function openEdit(task) {
    setEditTarget(task);
    setForm({
      title: task.Title || "",
      description: task.Description || "",
      doctorId: task.DoctorId || "",
      assignedTo: task.AssignedTo || "",
      priority: task.Priority || "Medium",
      dueDate: task.DueDate ? task.DueDate.slice(0, 10) : "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      showToast("Title is required.", "warning");
      return;
    }
    if (!form.doctorId) {
      showToast("Please select a doctor.", "warning");
      return;
    }
    if (!form.assignedTo) {
      showToast("Please assign to an employee.", "warning");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        dueDate: form.dueDate || null,
      };
      const res = editTarget
        ? await api.put(`/tasks/${editTarget.Id}`, body)
        : await api.post("/tasks", body);
      const { data } = res;
      if (!data.success) {
        showToast(data.message || "Save failed.", "error");
        return;
      }
      showToast(editTarget ? "Task updated." : "Task created.", "success");
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Save failed."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task, status) {
    try {
      const res = await api.patch(`/tasks/${task.Id}/status`, { status });
      const { data } = res;
      if (!data.success) {
        showToast(data.message || "Update failed.", "error");
        return;
      }
      showToast(`Task moved to ${status === "InProgress" ? "In Progress" : status}.`, "success");
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Update failed."), "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/tasks/${deleteTarget}`);
      const { data } = res;
      if (!data.success) {
        showToast(data.message || "Delete failed.", "error");
        return;
      }
      showToast("Task deleted.", "success");
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, "Delete failed."), "error");
    }
  }

  const f = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // ── Task Card (Kanban) ────────────────────────────────────────────────────
  // KanbanCard is defined inside the page (it uses setViewTask/openEdit), so React remounts
  // it on every render and its entrance animation replays. Kept as-is in the lint clean-up
  // because hoisting it changes that runtime behaviour; moving it out is a follow-up task.
  // eslint-disable-next-line react/no-unstable-nested-components -- see comment above
  function KanbanCard({ task, index }) {
    const cfg = COL_CFG[task.Status];
    const ps = PRIORITY_STYLE[task.Priority] || PRIORITY_STYLE.Medium;
    const overdue = task.Status !== "Completed"
      && task.Status !== "Cancelled"
      && isPast(task.DueDate);
    return (
      <div
        className="task-card-item"
        style={{ "--card-du": `${index * 0.05}s`, borderLeftWidth: 3, borderLeftColor: cfg.border }}
      >
        <div className="task-card-top">
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 20,
            background: ps.bg,
            color: ps.color,
          }}
          >
            {task.Priority?.toUpperCase()}
          </span>
          <span className="task-card-id">#{task.Id}</span>
        </div>

        <div className="task-card-main-title">{task.Title}</div>

        {task.DoctorName && (
          <div className="task-card-doctor-row">
            <span className="material-symbols-outlined">medical_services</span>
            {task.DoctorName}{task.DoctorSpec ? ` • ${task.DoctorSpec}` : ""}
          </div>
        )}
        {task.DoctorHospital && (
          <div className="task-card-loc">
            <span className="material-symbols-outlined">location_on</span>
            {[task.DoctorHospital, task.DoctorCity].filter(Boolean).join(", ")}
          </div>
        )}

        <div className="task-card-ft">
          <div className="task-card-assignee">
            <div style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#6366F1,#06B6D4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
            >
              {initials(task.AssigneeName)}
            </div>
            <span style={{ fontSize: 11, color: "var(--ds-text-2)" }}>{task.AssigneeName}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {task.DueDate && (
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: overdue ? "#EF4444" : "var(--ds-text-2)",
              }}
              >
                {overdue ? "Overdue · " : ""}{fmtDate(task.DueDate)}
              </span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{
          display: "flex",
          gap: 4,
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--ds-border)",
        }}
        >
          <button
            type="button"
            className="icon-btn"
            title="View"
            onClick={() => setViewTask(task)}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>visibility</span>
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Edit"
            onClick={() => openEdit(task)}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn-danger"
            title="Delete"
            onClick={() => setDeleteTarget(task.Id)}
            style={{ flex: 1, justifyContent: "center" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
          </button>
        </div>

        {/* Status move buttons */}
        <div style={{
          display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap",
        }}
        >
          {STATUSES.filter((s) => s !== task.Status).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => changeStatus(task, s)}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 6,
                border: `1px solid ${COL_CFG[s].border}`,
                background: COL_CFG[s].countBg,
                color: COL_CFG[s].countColor,
                cursor: "pointer",
              }}
            >
              → {COL_CFG[s].label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tasks-page">
      <ToastContainer toasts={toasts} />
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Task"
        message="This will permanently remove the task. This action cannot be undone."
        onConfirm={() => confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Tasks</span>
          </div>
          <h1 className="page-hd-title">Visit Tasks</h1>
          <p className="page-hd-sub">Create, assign, and track all doctor visit tasks</p>
        </div>
        <div className="page-hd-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => openAdd()}>
            <span className="material-symbols-outlined">add</span>
            New Task
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "16px 20px 8px",
      }}
      >
        {[
          {
            label: "Total Tasks", val: total, bg: "#EEF2FF", color: "#6366F1", icon: "task_alt",
          },
          {
            label: "Pending",
            val: pending,
            bg: "#FEF3C7",
            color: "#D97706",
            icon: "pending_actions",
          },
          {
            label: "In Progress", val: inProg, bg: "#EEF2FF", color: "#4F46E5", icon: "sync",
          },
          {
            label: "Completed",
            val: completed,
            bg: "#D1FAE5",
            color: "#10B981",
            icon: "check_circle",
          },
        ].map((s, i) => (
          <div
            key={s.label}
            className="stat-card dash-anim-card"
            style={{ "--card-delay": `${i * 0.08}s` }}
          >
            <div className="stat-card-top">
              <div className="stat-icon" style={{ background: s.bg }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: s.color, fontVariationSettings: "'FILL' 1" }}
                >
                  {s.icon}
                </span>
              </div>
            </div>
            <p className="stat-label">{s.label}</p>
            <p className="stat-val">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="tasks-toolbar">
        <div className="co-search" style={{ maxWidth: 260 }}>
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search tasks, doctors, employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="co-filter-select"
          value={priorityFilter}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="all">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          className="co-filter-select"
          value={employeeFilter}
          onChange={(e) => setEmployee(e.target.value)}
        >
          <option value="all">All Employees</option>
          {employees.map((e) => (
            <option
              key={e.Id}
              value={String(e.Id)}
            >
              {e.FirstName} {e.LastName}
            </option>
          ))}
        </select>
        <select
          className="co-filter-select"
          value={doctorFilter}
          onChange={(e) => setDoctor(e.target.value)}
        >
          <option value="all">All Doctors</option>
          {doctors.map((d) => <option key={d.Id} value={String(d.Id)}>{d.Name}</option>)}
        </select>
        <div className="tasks-view-btns" style={{ marginLeft: "auto" }}>
          <button
            type="button"
            className={`tasks-view-btn${view === "kanban" ? " active" : ""}`}
            onClick={() => setView("kanban")}
            title="Kanban"
          >
            <span className="material-symbols-outlined">view_kanban</span>
          </button>
          <button
            type="button"
            className={`tasks-view-btn${view === "list" ? " active" : ""}`}
            onClick={() => setView("list")}
            title="List"
          >
            <span className="material-symbols-outlined">table_rows</span>
          </button>
        </div>
      </div>

      {loading && (
        <div className="page-placeholder">
          <span
            className="material-symbols-outlined page-placeholder-icon"
            style={{ animation: "spin 1s linear infinite" }}
          >
            progress_activity
          </span>
          <p>Loading tasks...</p>
        </div>
      )}

      {/* Kanban Board */}
      {!loading && view === "kanban" && (
        <div className="tasks-board">
          {STATUSES.map((status) => {
            const cfg = COL_CFG[status];
            const cards = byStatus(status);
            return (
              <div key={status} className="tasks-col">
                <div className="tasks-col-hd" style={{ borderBottomColor: cfg.dot }}>
                  <div className="tasks-col-dot" style={{ background: cfg.dot }} />
                  <span className="tasks-col-title">{cfg.label}</span>
                  <span
                    className="tasks-col-count"
                    style={{ background: cfg.countBg, color: cfg.countColor }}
                  >
                    {cards.length}
                  </span>
                </div>
                {cards.map((task, i) => <KanbanCard key={task.Id} task={task} index={i} />)}
                {cards.length === 0 && (
                  <div style={{
                    textAlign: "center", padding: "24px 0", color: "var(--ds-text-2)", fontSize: 12,
                  }}
                  >
                    No tasks
                  </div>
                )}
                <button type="button" className="task-add-btn" onClick={() => openAdd(status)}>
                  <span className="material-symbols-outlined">add</span>
                  Add task
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {!loading && view === "list" && (
        <div style={{ margin: "0 20px 20px" }}>
          <div className="table-card" style={{ margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>Doctor</th>
                  <th>Assigned To</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task, i) => {
                  const ps = PRIORITY_STYLE[task.Priority] || PRIORITY_STYLE.Medium;
                  const cfg = COL_CFG[task.Status];
                  const overdue = task.Status !== "Completed"
                    && task.Status !== "Cancelled"
                    && isPast(task.DueDate);
                  return (
                    <tr
                      key={task.Id}
                      style={{ animation: `docFadeUp 0.3s ease ${i * 0.04}s both` }}
                    >
                      <td style={{ color: "var(--ds-text-2)", fontSize: 12 }}>#{task.Id}</td>
                      <td>
                        <div style={{
                          fontWeight: 600,
                          fontSize: 13,
                          color: "var(--ds-text)",
                        }}
                        >
                          {task.Title}
                        </div>
                        {task.Description && (
                        <div style={{
                          fontSize: 11,
                          color: "var(--ds-text-2)",
                          marginTop: 2,
                        }}
                        >
                          {task.Description.slice(0, 60)}{task.Description.length > 60 ? "…" : ""}
                        </div>
                        )}
                      </td>
                      <td>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                        >
                          {task.DoctorName || "—"}
                        </div>
                        {task.DoctorSpec && (
                        <div style={{
                          fontSize: 11,
                          color: "var(--ds-text-2)",
                        }}
                        >
                          {task.DoctorSpec}
                        </div>
                        )}
                      </td>
                      <td>
                        <div className="avatar-cell">
                          <div
                            className="avatar avatar-circle"
                            style={{
                              background: "linear-gradient(135deg,#6366F1,#06B6D4)",
                              width: 28,
                              height: 28,
                            }}
                          >
                            <span style={{
                              fontSize: 10,
                              color: "#fff",
                              fontWeight: 700,
                            }}
                            >
                              {initials(task.AssigneeName)}
                            </span>
                          </div>
                          <span style={{ fontSize: 12 }}>{task.AssigneeName || "—"}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: ps.bg,
                          color: ps.color,
                        }}
                        >
                          {task.Priority}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: cfg.countBg,
                          color: cfg.countColor,
                        }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{
                        fontSize: 12,
                        color: overdue ? "#EF4444" : "var(--ds-text-2)",
                        fontWeight: overdue ? 700 : 400,
                      }}
                      >
                        {fmtDate(task.DueDate) || "—"}
                      </td>
                      <td>
                        <div className="action-btns">
                          <div
                            className="icon-btn"
                            title="View"
                            role="button"
                            tabIndex={0}
                            onClick={() => setViewTask(task)}
                            onKeyDown={activateOnKey}
                          ><span className="material-symbols-outlined">visibility</span>
                          </div>
                          <div
                            className="icon-btn"
                            title="Edit"
                            role="button"
                            tabIndex={0}
                            onClick={() => openEdit(task)}
                            onKeyDown={activateOnKey}
                          ><span className="material-symbols-outlined">edit</span>
                          </div>
                          <div
                            className="icon-btn icon-btn-danger"
                            title="Delete"
                            role="button"
                            tabIndex={0}
                            onClick={() => setDeleteTarget(task.Id)}
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
                        <p>No tasks found.</p>
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
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EEF2FF" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#6366F1" }}
                >
                  assignment_add
                </span>
              </div>
              <div>
                <div className="modal-title">{editTarget ? "Edit Task" : "Create Visit Task"}</div>
                <div className="modal-sub">Assign a doctor visit to an employee</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setModalOpen(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="task-task-title" className="form-label">
                  Task Title <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <input
                  id="task-task-title"
                  className="form-input"
                  placeholder="Visit Dr. Mehta — Product Pitch Q2"
                  value={form.title}
                  onChange={f("title")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="task-description-instructions" className="form-label">
                  Description / Instructions
                </label>
                <textarea
                  id="task-description-instructions"
                  className="form-textarea"
                  rows={3}
                  placeholder="Present the new product line. Leave sample pack & brochure..."
                  value={form.description}
                  onChange={f("description")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="task-select-doctor" className="form-label">
                  Select Doctor <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  id="task-select-doctor"
                  className="form-select"
                  value={form.doctorId}
                  onChange={f("doctorId")}
                >
                  <option value="">— Select Doctor —</option>
                  {doctors.map((d) => (
                    <option key={d.Id} value={d.Id}>
                      {d.Name}
                      {d.Specialization ? ` — ${d.Specialization}` : ""}
                      {d.HospitalName ? ` • ${d.HospitalName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="task-assign-to-employee" className="form-label">
                  Assign To Employee <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  id="task-assign-to-employee"
                  className="form-select"
                  value={form.assignedTo}
                  onChange={f("assignedTo")}
                >
                  <option value="">— Select Employee —</option>
                  {employees.map((e) => (
                    <option
                      key={e.Id}
                      value={e.Id}
                    >
                      {e.FirstName} {e.LastName}{e.CompanyName ? ` — ${e.CompanyName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="task-priority" className="form-label">Priority</label>
                  <select
                    id="task-priority"
                    className="form-select"
                    value={form.priority}
                    onChange={f("priority")}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="task-due-date" className="form-label">Due Date</label>
                  <input
                    id="task-due-date"
                    className="form-input"
                    type="date"
                    value={form.dueDate}
                    onChange={f("dueDate")}
                  />
                </div>
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
                <span className="material-symbols-outlined">send</span>
                {saving ? "Saving..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewTask && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setViewTask(null)}
        >
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <div
                className="modal-header-icon"
                style={{ background: COL_CFG[viewTask.Status].countBg }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    color: COL_CFG[viewTask.Status].countColor,
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  {COL_CFG[viewTask.Status].icon}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="modal-title" style={{ whiteSpace: "normal" }}>{viewTask.Title}</div>
                <div className="modal-sub">Task #{viewTask.Id}</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setViewTask(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body" style={{ gap: 14 }}>
              {viewTask.Description && (
                <div style={{
                  fontSize: 13,
                  color: "var(--ds-text)",
                  lineHeight: 1.6,
                  padding: "10px 12px",
                  background: "var(--ds-surface-2, #F8FAFC)",
                  borderRadius: 8,
                }}
                >
                  {viewTask.Description}
                </div>
              )}
              {[
                {
                  icon: "medical_services",
                  label: "Doctor",
                  val: [viewTask.DoctorName, viewTask.DoctorSpec].filter(Boolean).join(" • "),
                },
                {
                  icon: "local_hospital",
                  label: "Hospital",
                  val: [viewTask.DoctorHospital, viewTask.DoctorCity].filter(Boolean).join(", "),
                },
                { icon: "person", label: "Assigned To", val: viewTask.AssigneeName },
                { icon: "manage_accounts", label: "Assigned By", val: viewTask.AssignedByName },
                { icon: "business", label: "Company", val: viewTask.CompanyName },
                { icon: "event", label: "Due Date", val: fmtDate(viewTask.DueDate) },
                { icon: "schedule", label: "Created", val: fmtDate(viewTask.CreatedAtUtc) },
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(() => {
                  const ps = PRIORITY_STYLE[viewTask.Priority] || PRIORITY_STYLE.Medium;
                  const cfg = COL_CFG[viewTask.Status];
                  return (
                    <>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: ps.bg,
                        color: ps.color,
                      }}
                      >
                        {viewTask.Priority}
                      </span>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: cfg.countBg,
                        color: cfg.countColor,
                      }}
                      >
                        {cfg.label}
                      </span>
                    </>
                  );
                })()}
              </div>
              {/* Quick status move */}
              <div>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--ds-text-2)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
                >
                  Move to
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUSES.filter((s) => s !== viewTask.Status).map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => {
                        changeStatus(viewTask, s);
                        setViewTask(null);
                      }}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "5px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        border: `1px solid ${COL_CFG[s].border}`,
                        background: COL_CFG[s].countBg,
                        color: COL_CFG[s].countColor,
                      }}
                    >
                      {COL_CFG[s].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setViewTask(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setViewTask(null);
                  openEdit(viewTask);
                }}
              >
                <span className="material-symbols-outlined">edit</span>
                Edit Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
