"use client";

import { useState, useEffect, useRef } from "react";

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

const LEAVES = [
  {
    id: 1,
    initials: "RS",
    color: "#06B6D4",
    name: "Rahul Shah",
    company: "MedReach Global",
    type: "Sick Leave",
    from: "Apr 7",
    to: "Apr 9",
    days: 3,
    reason: "Fever and flu",
    status: "Approved",
    manager: "Omar Al-Rashid",
  },
  {
    id: 2,
    initials: "NS",
    color: "#D946EF",
    name: "Nina Svensson",
    company: "BioXcel Corp",
    type: "Casual Leave",
    from: "Apr 10",
    to: "Apr 11",
    days: 2,
    reason: "Personal work",
    status: "Approved",
    manager: "Klaus Weber",
  },
  {
    id: 3,
    initials: "AK",
    color: "#F59E0B",
    name: "Arjun Kumar",
    company: "TheraCure Health",
    type: "Emergency Leave",
    from: "Apr 8",
    to: "Apr 8",
    days: 1,
    reason: "Family emergency",
    status: "Pending",
    manager: "Priya Sharma",
  },
  {
    id: 4,
    initials: "FA",
    color: "#EF4444",
    name: "Fatima Al-Ali",
    company: "MedReach Global",
    type: "Sick Leave",
    from: "Apr 7",
    to: "Apr 7",
    days: 1,
    reason: "Doctor appointment",
    status: "Rejected",
    manager: "Omar Al-Rashid",
  },
  {
    id: 5,
    initials: "LW",
    color: "#0EA5E9",
    name: "Liam Wilson",
    company: "Lumina Partners",
    type: "Annual Leave",
    from: "Apr 14",
    to: "Apr 18",
    days: 5,
    reason: "Family vacation",
    status: "Pending",
    manager: "Sarah Jenkins",
  },
  {
    id: 6,
    initials: "MK",
    color: "#8B5CF6",
    name: "Maria Kim",
    company: "NexGen Solutions",
    type: "Casual Leave",
    from: "Apr 20",
    to: "Apr 21",
    days: 2,
    reason: "Wedding ceremony",
    status: "Approved",
    manager: "Marcus Johnson",
  },
  {
    id: 7,
    initials: "JD",
    color: "#3B5FCF",
    name: "James Dunn",
    company: "Lumina Partners",
    type: "Sick Leave",
    from: "Apr 12",
    to: "Apr 13",
    days: 2,
    reason: "Medical procedure follow-up",
    status: "Pending",
    manager: "Sarah Jenkins",
  },
];

const LEAVE_TYPES = {
  "Sick Leave": { cls: "badge-danger" },
  "Casual Leave": { cls: "badge-accent" },
  "Emergency Leave": { cls: "badge-warning" },
  "Annual Leave": { cls: "badge-purple" },
};
const STATUS_STYLES = {
  Approved: { cls: "badge-success" },
  Pending: { cls: "badge-warning" },
  Rejected: { cls: "badge-danger" },
};

export default function LeavesPage() {
  const [active, setActive] = useState(false);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [leaves, setLeaves] = useState(LEAVES);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 50);
    return () => clearTimeout(t);
  }, []);

  const approved = leaves.filter((l) => l.status === "Approved").length;
  const pending = leaves.filter((l) => l.status === "Pending").length;
  const rejected = leaves.filter((l) => l.status === "Rejected").length;
  const totalDays = leaves.filter((l) => l.status === "Approved").reduce((s, l) => s + l.days, 0);

  const filtered = leaves.filter((l) => {
    const ms = l.name.toLowerCase().includes(search.toLowerCase())
      || l.company.toLowerCase().includes(search.toLowerCase());
    const mf = filter === "All" || l.status === filter;
    return ms && mf;
  });

  function approve(id) {
    setLeaves((ls) => ls.map((l) => (l.id === id ? { ...l, status: "Approved" } : l)));
  }
  function reject(id) {
    setLeaves((ls) => ls.map((l) => (l.id === id ? { ...l, status: "Rejected" } : l)));
  }

  // StatCard is defined inside the page (it reads `active`), so React remounts it on every
  // render and its count-up animation restarts. Kept as-is in the lint clean-up because
  // hoisting it changes that runtime behaviour; moving it out is a follow-up task.
  // eslint-disable-next-line react/no-unstable-nested-components -- see comment above
  function StatCard({
    icon, bg, color, label, value, sub, index,
  }) {
    const count = useCountUp(value, active);
    return (
      <div className="stat-card lv-stat-card" style={{ "--lv-du": `${index * 0.08}s` }}>
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
        <p className="stat-val">{active ? Math.round(count) : "0"}</p>
        <p className="stat-sub">{sub}</p>
      </div>
    );
  }

  return (
    <div className="lv-page">
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Leaves</span>
          </div>
          <h1 className="page-hd-title">Leave Management</h1>
          <p className="page-hd-sub">Review, approve, or reject employee leave requests</p>
        </div>
        <div className="page-hd-actions">
          <button type="button" className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">download</span>
            Export
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            New Request
          </button>
        </div>
      </div>

      <div className="lv-stat-grid">
        {/* eslint-disable react-hooks/static-components -- nested StatCard, see its definition */}
        <StatCard
          index={0}
          icon="check_circle"
          bg="#D1FAE5"
          color="#10B981"
          label="Approved"
          value={approved}
          sub="Requests approved"
        />
        <StatCard
          index={1}
          icon="pending_actions"
          bg="#FEF3C7"
          color="#F59E0B"
          label="Pending"
          value={pending}
          sub="Awaiting decision"
        />
        <StatCard
          index={2}
          icon="cancel"
          bg="#FEE2E2"
          color="#EF4444"
          label="Rejected"
          value={rejected}
          sub="Requests rejected"
        />
        <StatCard
          index={3}
          icon="event_busy"
          bg="#EDE9FE"
          color="#8B5CF6"
          label="Days Granted"
          value={totalDays}
          sub="Total approved days"
        />
        {/* eslint-enable react-hooks/static-components */}
      </div>

      <div className="co-toolbar">
        <div className="co-search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {["All", "Approved", "Pending", "Rejected"].map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className="filter-chip"
            style={filter === f ? {
              background: "#EEF2FF",
              color: "#1E3A8A",
              borderColor: "#1E3A8A",
            } : {}}
          >
            {f}
          </button>
        ))}
        <select className="co-filter-select">
          <option>All Leave Types</option>
          <option>Sick Leave</option>
          <option>Casual Leave</option>
          <option>Annual Leave</option>
          <option>Emergency Leave</option>
        </select>
      </div>

      <div className="lv-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Reason</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lv, i) => {
              const lt = LEAVE_TYPES[lv.type];
              const st = STATUS_STYLES[lv.status];
              return (
                <tr key={lv.id} style={{ animation: `lvFadeUp 0.35s ease ${i * 0.05}s both` }}>
                  <td>
                    <div className="avatar-cell">
                      <div
                        className="avatar avatar-circle"
                        style={{ background: lv.color }}
                      >
                        {lv.initials}
                      </div>
                      <div>
                        <div className="cell-name">{lv.name}</div>
                        <div className="cell-sub">{lv.company}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${lt.cls}`}>{lv.type}</span></td>
                  <td style={{ fontWeight: 500 }}>{lv.from}</td>
                  <td style={{ fontWeight: 500 }}>{lv.to}</td>
                  <td>
                    <strong style={{ color: "#1E3A8A" }}>{lv.days}</strong>
                    {" "}
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>
                      {lv.days === 1 ? "day" : "days"}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{lv.reason}</td>
                  <td style={{ fontSize: 12 }}>{lv.manager}</td>
                  <td><span className={`badge ${st.cls}`}>{lv.status}</span></td>
                  <td>
                    <div className="action-btns">
                      {lv.status === "Pending" ? (
                        <>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Approve"
                            onClick={() => approve(lv.id)}
                            style={{ background: "#D1FAE5", border: "1px solid #6EE7B7" }}
                          >
                            <span
                              className="material-symbols-outlined"
                              style={{ color: "#10B981" }}
                            >
                              check
                            </span>
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            title="Reject"
                            onClick={() => reject(lv.id)}
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </>
                      ) : (
                        <div className="icon-btn">
                          <span className="material-symbols-outlined">visibility</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="page-placeholder" style={{ minHeight: 150 }}>
            <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
            <p>No leave requests match your filter.</p>
          </div>
        )}
        <div className="co-pagination">
          <span>Showing {filtered.length} of {leaves.length} requests</span>
          <div className="co-page-btns">
            <button type="button" className="co-page-btn" disabled>‹</button>
            <button type="button" className="co-page-btn active">1</button>
            <button type="button" className="co-page-btn">›</button>
          </div>
        </div>
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-header-icon" style={{ background: "#EDE9FE" }}>
                <span
                  className="material-symbols-outlined"
                  style={{ color: "#8B5CF6" }}
                >
                  event_busy
                </span>
              </div>
              <div>
                <div className="modal-title">New Leave Request</div>
                <div className="modal-sub">Submit a leave request for an employee</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="leave-employee" className="form-label">Employee</label>
                <select id="leave-employee" className="form-select">
                  <option>Elena Rossi</option>
                  <option>James Dunn</option>
                  <option>Arjun Kumar</option>
                  <option>Maria Kim</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="leave-leave-type" className="form-label">Leave Type</label>
                <select id="leave-leave-type" className="form-select">
                  <option>Sick Leave</option>
                  <option>Casual Leave</option>
                  <option>Annual Leave</option>
                  <option>Emergency Leave</option>
                </select>
              </div>
              <div className="form-row form-row-2">
                <div className="form-group">
                  <label htmlFor="leave-from-date" className="form-label">From Date</label>
                  <input id="leave-from-date" className="form-input" type="date" />
                </div>
                <div className="form-group">
                  <label htmlFor="leave-to-date" className="form-label">To Date</label>
                  <input id="leave-to-date" className="form-input" type="date" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="leave-reason" className="form-label">Reason</label>
                <textarea
                  id="leave-reason"
                  className="form-textarea"
                  placeholder="Reason for leave..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowModal(false)}
              >
                <span className="material-symbols-outlined">send</span>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
