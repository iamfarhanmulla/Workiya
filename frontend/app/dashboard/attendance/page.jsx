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

const ATTENDANCE = [
  {
    id: 1,
    initials: "ER",
    color: "#10B981",
    name: "Elena Rossi",
    company: "NexGen Solutions",
    checkIn: "09:02 AM",
    checkOut: "06:14 PM",
    duration: "9h 12m",
    tasks: 3,
    status: "Present",
    loc: "Bandra, Mumbai",
  },
  {
    id: 2,
    initials: "JD",
    color: "#3B5FCF",
    name: "James Dunn",
    company: "Lumina Partners",
    checkIn: "08:55 AM",
    checkOut: "05:48 PM",
    duration: "8h 53m",
    tasks: 2,
    status: "Present",
    loc: "Andheri, Mumbai",
  },
  {
    id: 3,
    initials: "AK",
    color: "#F59E0B",
    name: "Arjun Kumar",
    company: "TheraCure Health",
    checkIn: "09:30 AM",
    checkOut: "—",
    duration: "Active",
    tasks: 1,
    status: "Active",
    loc: "Worli, Mumbai",
  },
  {
    id: 4,
    initials: "MK",
    color: "#8B5CF6",
    name: "Maria Kim",
    company: "NexGen Solutions",
    checkIn: "08:48 AM",
    checkOut: "06:02 PM",
    duration: "9h 14m",
    tasks: 4,
    status: "Present",
    loc: "Dadar, Mumbai",
  },
  {
    id: 5,
    initials: "RS",
    color: "#06B6D4",
    name: "Rahul Shah",
    company: "MedReach Global",
    checkIn: "—",
    checkOut: "—",
    duration: "—",
    tasks: 0,
    status: "On Leave",
    loc: "—",
  },
  {
    id: 6,
    initials: "FA",
    color: "#EF4444",
    name: "Fatima Al-Ali",
    company: "MedReach Global",
    checkIn: "—",
    checkOut: "—",
    duration: "—",
    tasks: 0,
    status: "Absent",
    loc: "—",
  },
  {
    id: 7,
    initials: "LW",
    color: "#0EA5E9",
    name: "Liam Wilson",
    company: "Lumina Partners",
    checkIn: "09:10 AM",
    checkOut: "—",
    duration: "Active",
    tasks: 2,
    status: "Active",
    loc: "Colaba, Mumbai",
  },
  {
    id: 8,
    initials: "NS",
    color: "#D946EF",
    name: "Nina Svensson",
    company: "BioXcel Corp",
    checkIn: "10:05 AM",
    checkOut: "04:30 PM",
    duration: "6h 25m",
    tasks: 1,
    status: "Present",
    loc: "Powai, Mumbai",
  },
];

const STATUS_STYLES = {
  Present: { cls: "badge-success", color: "#10B981" },
  Active: { cls: "badge-primary", color: "#1E3A8A" },
  "On Leave": { cls: "badge-warning", color: "#F59E0B" },
  Absent: { cls: "badge-danger", color: "#EF4444" },
};

// Last 7 days attendance summary
const WEEK_DATA = [
  {
    day: "Mon", present: 42, absent: 4, leave: 2,
  },
  {
    day: "Tue", present: 45, absent: 2, leave: 3,
  },
  {
    day: "Wed", present: 44, absent: 3, leave: 3,
  },
  {
    day: "Thu", present: 47, absent: 1, leave: 2,
  },
  {
    day: "Fri", present: 43, absent: 4, leave: 3,
  },
  {
    day: "Sat", present: 28, absent: 8, leave: 14,
  },
  {
    day: "Sun", present: 12, absent: 15, leave: 23,
  },
];

export default function AttendancePage() {
  const [active, setActive] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedDate] = useState("Apr 7, 2026");

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 50);
    return () => clearTimeout(t);
  }, []);

  const present = ATTENDANCE.filter((a) => a.status === "Present" || a.status === "Active").length;
  const onLeave = ATTENDANCE.filter((a) => a.status === "On Leave").length;
  const absent = ATTENDANCE.filter((a) => a.status === "Absent").length;
  const attendancePct = Math.round((present / ATTENDANCE.length) * 100);

  const filtered = ATTENDANCE.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase())
      || a.company.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "All" || a.status === filter;
    return matchSearch && matchFilter;
  });

  // StatCard is defined inside the page (it reads `active`), so React remounts it on every
  // render and its count-up animation restarts. Kept as-is in the lint clean-up because
  // hoisting it changes that runtime behaviour; moving it out is a follow-up task.
  // eslint-disable-next-line react/no-unstable-nested-components -- see comment above
  function StatCard({
    icon, bg, color, label, value, sub, index,
  }) {
    const count = useCountUp(value, active);
    return (
      <div className="stat-card att-stat-card" style={{ "--att-du": `${index * 0.08}s` }}>
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
    <div className="att-page">
      {/* Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Attendance</span>
          </div>
          <h1 className="page-hd-title">Attendance</h1>
          <p className="page-hd-sub">Monitor employee check-ins, durations, and field locations</p>
        </div>
        <div className="page-hd-actions">
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 12px",
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 8,
            fontSize: 13,
            color: "#475569",
          }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16 }}
            >
              calendar_today
            </span>
            {selectedDate}
          </div>
          <button type="button" className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="att-stat-grid">
        {/* eslint-disable react-hooks/static-components -- nested StatCard, see its definition */}
        <StatCard
          index={0}
          icon="check_circle"
          bg="#D1FAE5"
          color="#10B981"
          label="Present Today"
          value={present}
          sub={`${attendancePct}% attendance rate`}
        />
        <StatCard
          index={1}
          icon="schedule"
          bg="#EEF2FF"
          color="#1E3A8A"
          label="Currently Active"
          value={ATTENDANCE.filter((a) => a.status === "Active").length}
          sub="Checked in, in field"
        />
        <StatCard
          index={2}
          icon="event_available"
          bg="#FEF3C7"
          color="#F59E0B"
          label="On Leave"
          value={onLeave}
          sub="Approved leave today"
        />
        <StatCard
          index={3}
          icon="cancel"
          bg="#FEE2E2"
          color="#EF4444"
          label="Absent"
          value={absent}
          sub="Not checked in"
        />
        {/* eslint-enable react-hooks/static-components */}
      </div>

      {/* Weekly heatmap */}
      <div style={{ padding: "0 20px 16px" }}>
        <div className="panel-card dash-fade-up" style={{ "--du": "0.1s" }}>
          <div className="panel-head">
            <span className="panel-title">Weekly Attendance Overview</span>
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Apr 1–7, 2026</span>
          </div>
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-end", height: 90,
          }}
          >
            {WEEK_DATA.map((d) => {
              const total = d.present + d.absent + d.leave;
              const pPct = (d.present / total) * 100;
              const lPct = (d.leave / total) * 100;
              const aPct = (d.absent / total) * 100;
              const isToday = d.day === "Sun";
              return (
                <div
                  key={d.day}
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  }}
                >
                  <div style={{
                    width: "100%",
                    height: 70,
                    borderRadius: 6,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column-reverse",
                    border: isToday ? "2px solid #1E3A8A" : "none",
                  }}
                  >
                    <div style={{
                      width: "100%",
                      height: `${pPct}%`,
                      background: "#10B981",
                      transition: "height 0.8s ease",
                    }}
                    />
                    <div style={{ width: "100%", height: `${lPct}%`, background: "#F59E0B" }} />
                    <div style={{ width: "100%", height: `${aPct}%`, background: "#EF4444" }} />
                  </div>
                  <span style={{
                    fontSize: 10,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? "#1E3A8A" : "#94A3B8",
                  }}
                  >
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
            {[
              ["#10B981", "Present"],
              ["#F59E0B", "On Leave"],
              ["#EF4444", "Absent"],
            ].map(([c, l]) => (
              <div
                key={l}
                style={{
                  display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569",
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: 2, background: c,
                }}
                />
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
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
        {["All", "Present", "Active", "On Leave", "Absent"].map((f) => (
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
      </div>

      {/* Table */}
      <div className="att-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Company</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Duration</th>
              <th>Tasks Done</th>
              <th>Last Location</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => {
              const st = STATUS_STYLES[emp.status];
              return (
                <tr key={emp.id} style={{ animation: `attFadeUp 0.35s ease ${i * 0.05}s both` }}>
                  <td>
                    <div className="avatar-cell">
                      <div
                        className="avatar avatar-circle"
                        style={{ background: emp.color }}
                      >
                        {emp.initials}
                      </div>
                      <div className="cell-name">{emp.name}</div>
                    </div>
                  </td>
                  <td>{emp.company}</td>
                  <td>
                    <span style={{
                      fontWeight: emp.checkIn !== "—" ? 600 : 400,
                      color: emp.checkIn !== "—" ? "#0F172A" : "#94A3B8",
                    }}
                    >
                      {emp.checkIn}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: emp.checkOut !== "—" ? "#0F172A" : "#94A3B8" }}>
                      {emp.checkOut}
                    </span>
                  </td>
                  <td>
                    {emp.duration === "Active" ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#1E3A8A",
                          animation: "statusPulse 2s ease-in-out infinite",
                        }}
                        />
                        <span style={{ fontWeight: 600, color: "#1E3A8A" }}>Active</span>
                      </span>
                    ) : <span>{emp.duration}</span>}
                  </td>
                  <td><strong>{emp.tasks}</strong> tasks</td>
                  <td>
                    {emp.loc !== "—" ? (
                      <span style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: "#06B6D4",
                      }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: 13, fontVariationSettings: "'FILL' 1" }}
                        >
                          location_on
                        </span>
                        {emp.loc}
                      </span>
                    ) : <span style={{ color: "#94A3B8" }}>—</span>}
                  </td>
                  <td><span className={`badge ${st.cls}`}>{emp.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="page-placeholder" style={{ minHeight: 150 }}>
            <span className="material-symbols-outlined page-placeholder-icon">search_off</span>
            <p>No records match your filter.</p>
          </div>
        )}
        <div className="co-pagination">
          <span>Showing {filtered.length} of {ATTENDANCE.length} employees</span>
          <div className="co-page-btns">
            <button type="button" className="co-page-btn" disabled>‹</button>
            <button type="button" className="co-page-btn active">1</button>
            <button type="button" className="co-page-btn">›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
