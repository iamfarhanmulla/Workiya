"use client";

import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";

/* ── Animated counter ─────────────────────────── */
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

/* ── Stat card ────────────────────────────────── */
function StatCard({ card, index, active }) {
  const raw = parseFloat(card.value.replace(/[^0-9.]/g, ""));
  const suffix = card.value.includes("%") ? "%" : card.value.includes(",") ? "" : "";
  const count = useCountUp(raw, active);

  function formatCount(n) {
    if (card.value.includes(",")) return Math.round(n).toLocaleString();
    if (card.value.includes("%")) return n.toFixed(1) + "%";
    return Math.round(n).toString();
  }

  return (
    <div
      className="stat-card dash-anim-card"
      style={{ "--card-delay": `${index * 0.1}s` }}
    >
      <div className="stat-card-top">
        <div className="stat-icon">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            {card.icon}
          </span>
        </div>
        <span className={`stat-badge stat-badge--${card.badgeType}`}>{card.badge}</span>
      </div>
      <p className="stat-label">{card.label}</p>
      <p className="stat-value">{active ? formatCount(count) : "0"}</p>
      {card.progress !== undefined && (
        <div className="stat-progress-bar">
          <div
            className="stat-progress-fill"
            style={{ width: active ? `${card.progress}%` : "0%", transition: "width 1.3s cubic-bezier(.4,0,.2,1)" }}
          />
        </div>
      )}
      {card.sub && (
        <p className={`stat-sub${card.subDanger ? " stat-sub--danger" : ""}`}>{card.sub}</p>
      )}
    </div>
  );
}

/* ── Mini efficiency chart data ───────────────── */
const efficiencyData = [
  { v: 72 }, { v: 78 }, { v: 74 }, { v: 83 }, { v: 80 },
  { v: 87 }, { v: 85 }, { v: 90 }, { v: 88 }, { v: 94 },
];

const weeklyBar = [
  { d: "M", v: 68 }, { d: "T", v: 82 }, { d: "W", v: 91 },
  { d: "T", v: 75 }, { d: "F", v: 88 }, { d: "S", v: 60 }, { d: "S", v: 55 },
];

/* ── Live alerts list ─────────────────────────── */
const INITIAL_ALERTS = [
  { id: 1, title: "Late Check-in: Sarah J.", desc: "Site: North Plaza • 12 mins late", time: "2m ago",  isNew: false },
  { id: 2, title: "Boundary Exit: Mike W.",  desc: "Exited Geofence zone B-14",        time: "18m ago", isNew: false },
];

const LIVE_ALERTS = [
  { title: "Overtime Alert: James K.",   desc: "Exceeded 10h shift at Depot A",     time: "just now" },
  { title: "Check-out Missing: Ana R.", desc: "No check-out logged for Site B-3",  time: "just now" },
  { title: "Task Overdue: #TK-9034",   desc: "Security sweep not completed",        time: "just now" },
];

/* ── Data ─────────────────────────────────────── */
const statCards = [
  { icon: "groups",         badge: "+12%",    badgeType: "success", label: "Active Field Workers", value: "1,284", sub: "+82 Currently clocked in" },
  { icon: "task_alt",       badge: "84% Done",badgeType: "info",    label: "Today's Tasks",        value: "452",   progress: 84 },
  { icon: "calendar_month", badge: "Optimal", badgeType: "success", label: "Attendance Rate",       value: "98.2%", sub: "Last 24 hours monitoring" },
  { icon: "directions_car", badge: "●",       badgeType: "danger",  label: "Pending Leaves",        value: "14",    sub: "Requires immediate review", subDanger: true },
];

const tasks = [
  { status: "IN PROGRESS", statusClass: "badge-progress",  id: "#TK-9021", title: "Main Hub Server Maintenance", assignee: "Elena Rossi", avatar: "ER" },
  { status: "PENDING",     statusClass: "badge-pending",   id: "#TK-9020", title: "Security Audit: Floor 4",     assignee: null },
  { status: "COMPLETED",   statusClass: "badge-completed", id: "#TK-8998", title: "Hardware Delivery: Lab C",    assignee: "Closed 45m ago", closed: true },
];

/* ── Map dots ─────────────────────────────────── */
const MAP_DOTS = [
  { x: 52, y: 44, type: "onsite",  label: "Terminal A" },
  { x: 28, y: 61, type: "transit", label: "Route B-3"  },
  { x: 68, y: 58, type: "onsite",  label: "Depot C"    },
  { x: 40, y: 30, type: "transit", label: "Site NP"    },
  { x: 75, y: 35, type: "onsite",  label: "Hub East"   },
];

/* ── Page ─────────────────────────────────────── */
export default function DashboardPage() {
  const [animated, setAnimated]     = useState(false);
  const [alerts,   setAlerts]       = useState(INITIAL_ALERTS);
  const [nodeCount, setNodeCount]   = useState(142);
  const [activeDot, setActiveDot]   = useState(0);
  const [liveIdx,  setLiveIdx]      = useState(0);
  const [efficiency]                = useState(94);
  const effCount                    = useCountUp(efficiency, animated, 1600);

  /* Trigger animations */
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  /* Live node counter flicker */
  useEffect(() => {
    const id = setInterval(() => {
      setNodeCount(n => n + (Math.random() > 0.5 ? 1 : -1));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  /* Map dot pulse cycle */
  useEffect(() => {
    const id = setInterval(() => setActiveDot(d => (d + 1) % MAP_DOTS.length), 1800);
    return () => clearInterval(id);
  }, []);

  /* Push new live alert every 8 s */
  useEffect(() => {
    const id = setInterval(() => {
      setAlerts(prev => {
        const next = { ...LIVE_ALERTS[liveIdx % LIVE_ALERTS.length], id: Date.now(), isNew: true };
        return [next, ...prev].slice(0, 5);
      });
      setLiveIdx(i => i + 1);
    }, 8000);
    return () => clearInterval(id);
  }, [liveIdx]);

  return (
    <div className="op-overview">

      {/* Title row */}
      <div className={`op-title-row dash-fade-up`} style={{ "--du": "0s" }}>
        <div>
          <h1 className="op-title">Operational Overview</h1>
          <p className="op-subtitle">
            Real-time workforce intelligence for <strong>WorKiya Enterprise</strong>
          </p>
        </div>
        <div className="op-status-badge">
          <span className="op-status-dot op-status-pulse" />
          System Online: {nodeCount} Active Nodes
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {statCards.map((card, i) => (
          <StatCard key={i} card={card} index={i} active={animated} />
        ))}
      </div>

      {/* Body */}
      <div className="op-body">

        {/* Left column */}
        <div className="op-left">

          {/* Animated map */}
          <div className={`map-card dash-fade-up`} style={{ "--du": "0.3s" }}>
            <div className="map-toolbar">
              <div className="map-toolbar-left">
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>map</span>
                <div>
                  <span className="map-label">MAP VIEW</span>
                  <span className="map-title">Downtown Operations</span>
                </div>
              </div>
              <div className="map-legend">
                <span className="legend-dot legend-dot--green" />On-Site
                <span className="legend-dot legend-dot--blue" />Transit
              </div>
            </div>

            <div className="map-body map-body--live">
              {/* Grid lines */}
              <svg className="map-grid" viewBox="0 0 100 100" preserveAspectRatio="none">
                {[20,40,60,80].map(v => (
                  <g key={v}>
                    <line x1={v} y1="0" x2={v} y2="100" stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
                    <line x1="0" y1={v} x2="100" y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.4" />
                  </g>
                ))}
                {/* Route lines */}
                <polyline points="28,61 40,30 52,44 68,58 75,35"
                  fill="none" stroke="rgba(99,179,237,0.3)" strokeWidth="0.5" strokeDasharray="2,2" />
              </svg>

              {/* Dots */}
              {MAP_DOTS.map((dot, i) => (
                <div
                  key={i}
                  className={`map-dot map-dot--${dot.type} ${i === activeDot ? "map-dot--active" : ""}`}
                  style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
                  title={dot.label}
                >
                  {i === activeDot && <span className="map-dot-ring" />}
                  {i === 0 && <span className="map-task-float">Task: Terminal A Inspection</span>}
                </div>
              ))}

              <div className="map-controls">
                <button>+</button>
                <button>−</button>
                <button><span className="material-symbols-outlined" style={{ fontSize: 17 }}>my_location</span></button>
              </div>
            </div>
          </div>

          {/* Weekly bar chart */}
          <div className={`dash-chart-card dash-fade-up`} style={{ "--du": "0.4s" }}>
            <div className="dash-chart-header">
              <div>
                <p className="dash-chart-title">Weekly Activity</p>
                <p className="dash-chart-sub">Check-ins across all sites</p>
              </div>
              <span className="dash-chart-badge">This Week</span>
            </div>
            <ResponsiveContainer width="100%" height={90}>
              <BarChart data={weeklyBar} barCategoryGap="25%">
                <Bar dataKey="v" radius={[4,4,0,0]} isAnimationActive={animated} animationDuration={1200}>
                  {weeklyBar.map((_, i) => (
                    <Cell key={i} fill={i === 2 ? "#24339a" : "#dde3f5"} />
                  ))}
                </Bar>
                <Tooltip
                  cursor={false}
                  content={({ active, payload, label }) =>
                    active && payload?.length
                      ? <div className="rpt-tooltip"><p className="rpt-tooltip-val">{payload[0].value}%</p></div>
                      : null
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Metric row */}
          <div className="metric-row">
            {[
              { icon: "route", label: "TOTAL DISTANCE (TODAY)", val: "1,420.5 km" },
              { icon: "timer", label: "RESPONSE LATENCY",       val: "14.2 min"   },
            ].map((m, i) => (
              <div className={`metric-card dash-fade-up`} key={i} style={{ "--du": `${0.5 + i * 0.08}s` }}>
                <div className="metric-icon">
                  <span className="material-symbols-outlined">{m.icon}</span>
                </div>
                <div>
                  <p className="metric-label">{m.label}</p>
                  <p className="metric-value">{m.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="op-right">

          {/* Recent Alerts */}
          <div className={`panel-card dash-fade-up`} style={{ "--du": "0.2s" }}>
            <div className="panel-header">
              <span className="panel-title">Recent Alerts</span>
              <span className="live-badge live-blink">LIVE</span>
            </div>
            <div className="alerts-list">
              {alerts.map((a) => (
                <div key={a.id} className={`alert-item ${a.isNew ? "alert-item--new" : ""}`}>
                  <div className="alert-bar" />
                  <div style={{ flex: 1 }}>
                    <p className="alert-title">{a.title}</p>
                    <p className="alert-desc">{a.desc}</p>
                  </div>
                  <span className="alert-time">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Active Tasks */}
          <div className={`panel-card dash-fade-up`} style={{ "--du": "0.28s" }}>
            <div className="panel-header">
              <span className="panel-title">Active Tasks</span>
              <a href="/dashboard/tasks" className="panel-link">View All</a>
            </div>
            <div className="tasks-list">
              {tasks.map((t, i) => (
                <div className="task-item task-item-anim" key={i} style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
                  <div className="task-item-top">
                    <span className={`task-badge ${t.statusClass}`}>{t.status}</span>
                    <span className="task-id">{t.id}</span>
                  </div>
                  <p className="task-title">{t.title}</p>
                  <p className="task-assignee">
                    {t.closed
                      ? <span className="task-closed">✓ {t.assignee}</span>
                      : t.assignee
                        ? <><span className="task-avatar">{t.avatar}</span>Assigned to: {t.assignee}</>
                        : <span className="task-unassigned">Unassigned</span>
                    }
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Efficiency card */}
          <div className={`efficiency-card dash-fade-up`} style={{ "--du": "0.36s" }}>
            <p className="efficiency-label">Weekly Completion</p>
            <p className="efficiency-value">{animated ? Math.round(effCount) : 0}% Efficiency</p>
            <div className="efficiency-progress-wrap">
              <div className="efficiency-progress-bar">
                <div
                  className="efficiency-progress-fill"
                  style={{ width: animated ? `${efficiency}%` : "0%", transition: "width 1.6s cubic-bezier(.4,0,.2,1) 0.4s" }}
                />
              </div>
              <span className="efficiency-progress-label">{efficiency}%</span>
            </div>
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart data={efficiencyData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="effGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="rgba(255,255,255,0.3)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone" dataKey="v"
                  stroke="rgba(255,255,255,0.8)" strokeWidth={2}
                  fill="url(#effGrad)"
                  dot={false}
                  isAnimationActive={animated} animationDuration={1800}
                />
              </AreaChart>
            </ResponsiveContainer>
            <button className="efficiency-btn">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span>
              Download Report
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
