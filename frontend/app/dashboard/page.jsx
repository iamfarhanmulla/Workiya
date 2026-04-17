"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";

/* ── Animated counter hook ─────────────────────── */
function useCountUp(target, active, duration = 1400) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(eased * target);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [active, target, duration]);
  return val;
}

/* ── Stat Card ─────────────────────────────────── */
function StatCard({ icon, iconBg, iconColor, label, value, delta, deltaType, sub, index }) {
  const [active, setActive] = useState(false);
  useEffect(() => { const t = setTimeout(() => setActive(true), index * 100); return () => clearTimeout(t); }, [index]);
  const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
  const count = useCountUp(num, active);

  function fmt(n) {
    if (String(value).includes("k")) return (n / 1000).toFixed(1) + "k";
    if (String(value).includes(",")) return Math.round(n).toLocaleString();
    if (String(value).includes("%")) return n.toFixed(1) + "%";
    return Math.round(n).toLocaleString();
  }

  return (
    <div className="stat-card dash-anim-card" style={{ "--card-delay": `${index * 0.08}s` }}>
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: iconBg }}>
          <span className="material-symbols-outlined" style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }}>
            {icon}
          </span>
        </div>
        <span className={`delta ${deltaType === "up" ? "delta-up" : "delta-dn"}`}>{delta}</span>
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-val">{active ? fmt(count) : "0"}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  );
}

/* ── Chart Data ────────────────────────────────── */
const weeklyData = [
  { d: "Mon", v: 68 }, { d: "Tue", v: 82 }, { d: "Wed", v: 91 },
  { d: "Thu", v: 75 }, { d: "Fri", v: 88 }, { d: "Sat", v: 60 }, { d: "Sun", v: 55 },
];
const effData = [
  { v: 72 }, { v: 78 }, { v: 74 }, { v: 83 }, { v: 80 },
  { v: 87 }, { v: 85 }, { v: 90 }, { v: 88 }, { v: 94 },
];

/* ── Live Alerts ───────────────────────────────── */
const ALERT_POOL = [
  { text: "Elena Rossi checked in at Lilavati Hospital", color: "#10B981", icon: "check_circle" },
  { text: "New company NexGen Solutions registered", color: "#06B6D4", icon: "apartment" },
  { text: "Task #TK-1042 marked completed by James Dunn", color: "#10B981", icon: "task_alt" },
  { text: "Manager added 3 new doctors in Mumbai region", color: "#8B5CF6", icon: "medical_services" },
  { text: "Feedback score 4.9/5 from Dr. Mehta visit", color: "#F59E0B", icon: "star" },
  { text: "Arjun Kumar started task — Dr. Patel visit", color: "#1E3A8A", icon: "directions_walk" },
];

/* ── Companies table data ──────────────────────── */
const COMPANIES = [
  { id: 1, initials: "NX", color: "#6C5CE7", name: "NexGen Solutions", loc: "San Francisco, CA", manager: "Mark Veridan", employees: 1420, plan: "ENTERPRISE", tasks: 892, taskPct: 78, status: "Active" },
  { id: 2, initials: "LP", color: "#00B894", name: "Lumina Partners", loc: "London, UK", manager: "Sarah Jenkins", employees: 345, plan: "PRO", tasks: 312, taskPct: 45, status: "Active" },
  { id: 3, initials: "TH", color: "#E17055", name: "TheraCure Health", loc: "Mumbai, IN", manager: "Priya Sharma", employees: 780, plan: "ENTERPRISE", tasks: 654, taskPct: 66, status: "Active" },
  { id: 4, initials: "BX", color: "#0984E3", name: "BioXcel Corp", loc: "Berlin, DE", manager: "Klaus Weber", employees: 212, plan: "STARTER", tasks: 98, taskPct: 28, status: "Inactive" },
  { id: 5, initials: "MR", color: "#FDCB6E", name: "MedReach Global", loc: "Dubai, UAE", manager: "Omar Al-Rashid", employees: 540, plan: "PRO", tasks: 411, taskPct: 57, status: "Active" },
];

const PLAN_STYLES = {
  ENTERPRISE: "badge-primary",
  PRO:        "badge-purple",
  STARTER:    "badge-success",
  TRIAL:      "badge-warning",
};

export default function DashboardPage() {
  const [alerts, setAlerts] = useState(ALERT_POOL.slice(0, 4));
  const [nodeCount, setNodeCount] = useState(84218);
  const [effProgress, setEffProgress] = useState(0);
  const alertIdx = useRef(4);

  /* Rotate live alerts */
  useEffect(() => {
    const t = setInterval(() => {
      const next = ALERT_POOL[alertIdx.current % ALERT_POOL.length];
      alertIdx.current++;
      setAlerts(prev => [{ ...next, _id: Date.now() }, ...prev.slice(0, 4)]);
    }, 7000);
    return () => clearInterval(t);
  }, []);

  /* Flicker node count */
  useEffect(() => {
    const t = setInterval(() => {
      setNodeCount(n => n + Math.floor(Math.random() * 3) - 1);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  /* Animate efficiency progress bar */
  useEffect(() => {
    const t = setTimeout(() => setEffProgress(94), 600);
    return () => clearTimeout(t);
  }, []);

  /* Live map dots */
  const mapDots = [
    { top: "30%", left: "28%", type: "onsite",  task: "Dr. Mehta" },
    { top: "55%", left: "48%", type: "transit", task: "En route" },
    { top: "40%", left: "68%", type: "onsite",  task: "Dr. Singh" },
    { top: "70%", left: "35%", type: "transit", task: "En route" },
    { top: "25%", left: "58%", type: "onsite",  task: "Dr. Patel" },
  ];

  return (
    <div style={{ padding: "0 0 24px" }}>

      {/* Page Header */}
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">Dashboard</span>
          </div>
          <h1 className="page-hd-title">Platform Overview</h1>
          <p className="page-hd-sub">Real-time intelligence across all companies and field agents</p>
        </div>
        <div className="page-hd-actions">
          <div className="op-status-badge">
            <span className="op-status-dot" />
            All Systems Operational
          </div>
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">download</span>
            Export
          </button>
          <button className="btn btn-primary btn-sm">
            <span className="material-symbols-outlined">add</span>
            Add Company
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <StatCard index={0} icon="apartment"     iconBg="#EEF2FF" iconColor="#1E3A8A"
          label="Total Companies" value="1284" delta="+12%" deltaType="up" sub="48 added this month" />
        <StatCard index={1} icon="manage_accounts" iconBg="#EDE9FE" iconColor="#8B5CF6"
          label="Active Managers" value="4902" delta="+5%" deltaType="up" sub="Across all companies" />
        <StatCard index={2} icon="person_pin"    iconBg="#ECFEFF" iconColor="#06B6D4"
          label="Field Employees" value="84218" delta="+8%" deltaType="up" sub={`${nodeCount.toLocaleString()} active now`} />
        <StatCard index={3} icon="task_alt"      iconBg="#FEF3C7" iconColor="#F59E0B"
          label="Tasks Completed" value="128000" delta="+24%" deltaType="up" sub="This month" />
      </div>

      {/* Body */}
      <div className="op-body" style={{ padding: "0 20px", gap: 16 }}>

        {/* Left column */}
        <div className="op-left">

          {/* Live Map */}
          <div className="dash-chart-card dash-fade-up" style={{ "--du": "0.15s", padding: 0, overflow: "hidden" }}>
            <div className="dash-chart-header" style={{ padding: "14px 18px 12px" }}>
              <div>
                <p className="dash-chart-title">Live Field Map</p>
                <p className="dash-chart-sub">Real-time agent positions — updates every 30s</p>
              </div>
              <span className="dash-chart-badge" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span className="live-blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
                LIVE
              </span>
            </div>
            <div className="map-body--live">
              <svg className="map-grid" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid meet">
                {Array.from({ length: 12 }).map((_, i) => (
                  <line key={`v${i}`} x1={i * 35} y1="0" x2={i * 35} y2="260" stroke="rgba(96,165,250,0.15)" strokeWidth="1" />
                ))}
                {Array.from({ length: 9 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 35} x2="400" y2={i * 35} stroke="rgba(96,165,250,0.15)" strokeWidth="1" />
                ))}
                <path d="M112,78 Q180,120 192,143 Q210,175 140,182" stroke="#60A5FA" strokeWidth="1.5" fill="none" strokeDasharray="5 4" opacity="0.6" />
                <path d="M272,104 Q260,140 264,175" stroke="#60A5FA" strokeWidth="1.5" fill="none" strokeDasharray="5 4" opacity="0.6" />
              </svg>
              {mapDots.map((dot, i) => (
                <div
                  key={i}
                  className={`map-dot map-dot--${dot.type}`}
                  style={{ top: dot.top, left: dot.left }}
                >
                  <div className="map-dot-ring" />
                  <div className="map-task-float">{dot.task}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px", display: "flex", gap: 16, borderTop: "1px solid #E2E8F0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
                On-site ({mapDots.filter(d => d.type === "onsite").length})
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#60A5FA" }} />
                In Transit ({mapDots.filter(d => d.type === "transit").length})
              </div>
            </div>
          </div>

          {/* Weekly Tasks Chart */}
          <div className="dash-chart-card dash-fade-up" style={{ "--du": "0.2s" }}>
            <div className="dash-chart-header">
              <div>
                <p className="dash-chart-title">Weekly Task Completions</p>
                <p className="dash-chart-sub">Doctor visits completed per day — this week</p>
              </div>
              <span className="dash-chart-badge">↑ 18% vs last week</span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={weeklyData} barSize={28}>
                <Tooltip
                  content={({ active, payload }) => active && payload?.length ? (
                    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
                      <b style={{ color: "#1E3A8A" }}>{payload[0].value}</b> tasks
                    </div>
                  ) : null}
                />
                <Bar dataKey="v" radius={[5, 5, 0, 0]}>
                  {weeklyData.map((e, i) => (
                    <Cell key={i} fill={e.v === Math.max(...weeklyData.map(d => d.v)) ? "#1E3A8A" : "#EEF2FF"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 4 }}>
              {weeklyData.map(d => (
                <span key={d.d} style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>{d.d}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="op-right">

          {/* Efficiency */}
          <div className="efficiency-card dash-fade-up" style={{ "--du": "0.1s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,.7)", margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Platform Efficiency</p>
                <p className="efficiency-big-val">94%</p>
              </div>
              <div>
                <ResponsiveContainer width={80} height={60}>
                  <AreaChart data={effData}>
                    <Area type="monotone" dataKey="v" stroke="rgba(255,255,255,.8)" fill="rgba(255,255,255,.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="efficiency-progress-wrap">
              <div className="efficiency-progress-bar">
                <div className="efficiency-progress-fill" style={{ width: `${effProgress}%`, transition: "width 1.4s ease" }} />
              </div>
              <span className="efficiency-progress-label">{effProgress}%</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
              {[
                { label: "Check-in Rate", val: "98.2%" },
                { label: "On-time Rate", val: "91.7%" },
                { label: "Feedback Rate", val: "96.4%" },
                { label: "Avg Rating", val: "4.7/5" },
              ].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,.1)", borderRadius: 8, padding: "8px 10px" }}>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".07em", fontWeight: 700 }}>{m.label}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Live Alerts */}
          <div className="panel-card dash-fade-up" style={{ "--du": "0.18s" }}>
            <div className="panel-head">
              <span className="panel-title">Live Activity Feed</span>
              <span className="dash-chart-badge" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                <span className="live-blink" style={{ width: 5, height: 5, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />
                LIVE
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {alerts.map((a, i) => (
                <div key={a._id || i} className={`alert-item${i === 0 ? " alert-item--new" : ""}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: a.color, fontVariationSettings: "'FILL' 1", flexShrink: 0, marginTop: 1 }}>
                    {a.icon}
                  </span>
                  <span className="alert-text">{a.text}</span>
                  <span className="alert-time">{i === 0 ? "just now" : `${(i + 1) * 2}m ago`}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="panel-card dash-fade-up" style={{ "--du": "0.22s" }}>
            <div className="panel-head">
              <span className="panel-title">Today's Summary</span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Apr 7, 2026</span>
            </div>
            {[
              { label: "New Registrations", val: "12 companies", icon: "apartment", color: "#1E3A8A", bg: "#EEF2FF" },
              { label: "Doctor Visits Done", val: "1,284 visits", icon: "medical_services", color: "#06B6D4", bg: "#ECFEFF" },
              { label: "Feedback Submitted", val: "1,198 forms", icon: "rate_review", color: "#8B5CF6", bg: "#EDE9FE" },
              { label: "Pending Tasks", val: "234 tasks", icon: "pending_actions", color: "#F59E0B", bg: "#FEF3C7" },
            ].map((item, i) => (
              <div key={item.label} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 10px", borderRadius: 8, background: "#F8FAFC",
                marginBottom: 6, animation: `dashRowIn 0.35s ease ${i * 0.06 + 0.1}s both`
              }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: item.color, fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#94A3B8", fontWeight: 500 }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{item.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Companies Table */}
      <div style={{ padding: "16px 20px 0" }}>
        <div className="table-card" style={{ margin: 0 }}>
          <div className="table-toolbar">
            <span className="table-toolbar-title">Recent Companies</span>
            <div className="table-search">
              <span className="material-symbols-outlined">search</span>
              <input type="text" placeholder="Search companies..." />
            </div>
            <div className="filter-chip">
              <span className="material-symbols-outlined">tune</span>
              Filter
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}>
              <span className="material-symbols-outlined">add</span>
              New Company
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Manager</th>
                <th>Employees</th>
                <th>Plan</th>
                <th>Tasks This Month</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {COMPANIES.map((co, i) => (
                <tr key={co.id} style={{ animation: `dashRowIn 0.35s ease ${i * 0.05 + 0.2}s both` }}>
                  <td>
                    <div className="avatar-cell">
                      <div className="avatar" style={{ background: co.color, borderRadius: 9 }}>{co.initials}</div>
                      <div>
                        <div className="cell-name">{co.name}</div>
                        <div className="cell-sub">{co.loc}</div>
                      </div>
                    </div>
                  </td>
                  <td>{co.manager}</td>
                  <td><strong>{co.employees.toLocaleString()}</strong></td>
                  <td>
                    <span className={`badge ${PLAN_STYLES[co.plan]}`}>{co.plan}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: "#E2E8F0", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${co.taskPct}%`, height: "100%", background: co.plan === "PRO" ? "#8B5CF6" : "#1E3A8A", borderRadius: 999 }} />
                      </div>
                      <span style={{ fontSize: 11 }}>{co.tasks}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${co.status === "Active" ? "badge-success" : "badge-danger"}`}>
                      {co.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      <div className="icon-btn" title="View">
                        <span className="material-symbols-outlined">visibility</span>
                      </div>
                      <div className="icon-btn" title="Edit">
                        <span className="material-symbols-outlined">edit</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
