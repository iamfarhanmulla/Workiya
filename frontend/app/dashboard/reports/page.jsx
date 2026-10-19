"use client";

import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import activateOnKey from "@/app/dashboard/_utils/activateOnKey";

/* ── Data ─────────────────────────────────────── */
const attendanceData = [
  { day: "MON", value: 68 },
  { day: "TUE", value: 82 },
  { day: "WED", value: 95 },
  { day: "THU", value: 74 },
  { day: "FRI", value: 89 },
  { day: "SAT", value: 55 },
  { day: "SUN", value: 60 },
  { day: "MON", value: 77 },
  { day: "TUE", value: 91 },
  { day: "WED", value: 48 },
  { day: "THU", value: 98 },
  { day: "FRI", value: 72 },
  { day: "SAT", value: 63 },
];

const taskTrendData = [
  { month: "Jan", rate: 72 },
  { month: "Feb", rate: 68 },
  { month: "Mar", rate: 75 },
  { month: "Apr", rate: 74 },
  { month: "May", rate: 80 },
  { month: "Jun", rate: 85 },
  { month: "Jul", rate: 82 },
  { month: "Aug", rate: 88 },
  { month: "Sep", rate: 86 },
  { month: "Oct", rate: 91 },
  { month: "Nov", rate: 92 },
  { month: "Dec", rate: 94.2 },
];

const leaveTypes = [
  {
    label: "Sick Leave", pct: 52, color: "#24339a", days: 64,
  },
  {
    label: "Vacation", pct: 34, color: "#22c55e", days: 42,
  },
  {
    label: "Personal", pct: 14, color: "#ef4444", days: 18,
  },
];

const employees = [
  {
    initials: "JD",
    name: "Jameson Dunn",
    role: "Frontend Dev",
    checkin: "08:54 AM",
    tasks: 142,
    attendance: 98,
    perf: "EXCEPTIONAL",
    perfClass: "perf-exceptional",
  },
  {
    initials: "SM",
    name: "Sarah Mitchell",
    role: "Project Manager",
    checkin: "09:12 AM",
    tasks: 118,
    attendance: 92,
    perf: "ON TRACK",
    perfClass: "perf-ontrack",
  },
  {
    initials: "AK",
    name: "Arjun Kapoor",
    role: "QA Engineer",
    checkin: "09:05 AM",
    tasks: 96,
    attendance: 85,
    perf: "ON TRACK",
    perfClass: "perf-ontrack",
  },
  {
    initials: "LR",
    name: "Leo Richards",
    role: "System Admin",
    checkin: "09:45 AM",
    tasks: 64,
    attendance: 76,
    perf: "NEEDS REVIEW",
    perfClass: "perf-review",
  },
];

const RANGES = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "This Year"];

function attendanceColor(pct) {
  if (pct >= 90) return "#22c55e";
  if (pct >= 80) return "#f59e0b";
  return "#ef4444";
}

/* ── Donut chart (pure SVG) ───────────────────── */
function DonutChart({ segments, total, animate }) {
  const r = 70;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;
  // Start of each segment, in percent: the sum of the segments before it.
  const offsets = segments.map((_, i) => segments.slice(0, i).reduce((sum, s) => sum + s.pct, 0));

  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f2f8" strokeWidth={22} />
      {segments.map(({ label, pct, color }, i) => {
        const dash = (pct / 100) * circ;
        const gap = circ - dash;
        const rot = offsets[i] * 3.6 - 90;
        return (
          <circle
            key={label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={22}
            strokeDasharray={`${animate ? dash : 0} ${gap}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(${rot} ${cx} ${cy})`}
            style={{ transition: `stroke-dasharray 1.2s ease ${i * 0.2}s` }}
          />
        );
      })}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize={26}
        fontWeight={800}
        fill="#17233f"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="#8a91a7"
        letterSpacing="1"
      >
        TOTAL DAYS
      </text>
    </svg>
  );
}

/* ── Animated counter ─────────────────────────── */
function Counter({ target, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    let start = null;
    const duration = 1400;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(parseFloat((p * target).toFixed(1)));
      if (p < 1) ref.current = requestAnimationFrame(step);
    };
    ref.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(ref.current);
  }, [target]);

  return <>{val}{suffix}</>;
}

/* ── Custom bar tooltip ───────────────────────── */
function AttTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rpt-tooltip">
      <p className="rpt-tooltip-label">{label}</p>
      <p className="rpt-tooltip-val">{payload[0].value}% Present</p>
    </div>
  );
}

function TaskTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rpt-tooltip">
      <p className="rpt-tooltip-label">{label}</p>
      <p className="rpt-tooltip-val">{payload[0].value}%</p>
    </div>
  );
}

/* ── Attendance bar colour ───────────────────── */
const HIGHLIGHT_DAYS = [2, 9]; // WED, THU (indices)

/* ── Page ─────────────────────────────────────── */
export default function ReportsPage() {
  const [range, setRange] = useState("Last 30 Days");
  const [dropdown, setDropdown] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="rpt-page">

      {/* Page header */}
      <div className="rpt-page-header">
        <h1 className="rpt-page-title">Intelligence Reports</h1>
        <div className="rpt-header-actions">
          {/* Date range */}
          <div className="rpt-range-wrap">
            <button type="button" className="rpt-range-btn" onClick={() => setDropdown((d) => !d)}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                calendar_month
              </span>
              {range}
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16 }}
              >
                expand_more
              </span>
            </button>
            {dropdown && (
              <ul className="rpt-dropdown" role="listbox">
                {RANGES.map((r) => (
                  <li
                    key={r}
                    className={r === range ? "active" : ""}
                    role="option"
                    aria-selected={r === range}
                    tabIndex={0}
                    onClick={() => {
                      setRange(r);
                      setDropdown(false);
                    }}
                    onKeyDown={activateOnKey}
                  >
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Download */}
          <button type="button" className="rpt-download-btn">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Download PDF/CSV
          </button>

          <button type="button" className="dash-icon-btn" aria-label="Notifications">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button type="button" className="dash-icon-btn" aria-label="Apps">
            <span className="material-symbols-outlined">apps</span>
          </button>
          <button type="button" className="dash-icon-btn" aria-label="Help">
            <span className="material-symbols-outlined">help</span>
          </button>
        </div>
      </div>

      {/* Top row: Attendance bar chart + Donut */}
      <div className="rpt-top-row">

        {/* Bar chart */}
        <div className={`rpt-card rpt-card--bar ${animated ? "rpt-card--in" : ""}`}>
          <div className="rpt-card-header">
            <div>
              <h2 className="rpt-card-title">Daily Attendance Trends</h2>
              <p className="rpt-card-sub">Daily check-in volume across all sectors</p>
            </div>
            <div className="rpt-legend">
              <span className="rpt-legend-dot" style={{ background: "#24339a" }} />
              Present
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceData} barCategoryGap="30%">
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#8a91a7", fontSize: 12 }}
              />
              <YAxis hide />
              <Tooltip content={<AttTooltip />} cursor={{ fill: "rgba(36,51,154,0.05)" }} />
              <Bar
                dataKey="value"
                radius={[6, 6, 0, 0]}
                isAnimationActive={animated}
                animationDuration={1200}
              >
                {attendanceData.map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key -- day names repeat
                  <Cell key={i} fill={HIGHLIGHT_DAYS.includes(i) ? "#24339a" : "#d4d9f0"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut */}
        <div className={`rpt-card rpt-card--donut ${animated ? "rpt-card--in" : ""}`}>
          <h2 className="rpt-card-title">Leave Types Distribution</h2>
          <div className="rpt-donut-wrap">
            <DonutChart segments={leaveTypes} total={124} animate={animated} />
          </div>
          <ul className="rpt-legend-list">
            {leaveTypes.map(({ label, pct, color }) => (
              <li key={label} className="rpt-legend-item">
                <span className="rpt-legend-dot" style={{ background: color }} />
                <span className="rpt-legend-label">{label}</span>
                <span className="rpt-legend-pct">{pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Task completion area chart */}
      <div className={`rpt-card rpt-card--area ${animated ? "rpt-card--in" : ""}`}>
        <div className="rpt-area-header">
          <div>
            <h2 className="rpt-card-title">Task Completion Rate</h2>
            <p className="rpt-card-sub">
              Over time performance analysis against established
              <br />
              quarterly KPIs and operational goals.
            </p>
          </div>
          <div className="rpt-area-stat">
            <span className="rpt-area-pct"><Counter target={94.2} suffix="%" /></span>
            <span className="rpt-area-delta">+2.4% FROM LAST MONTH</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart
            data={taskTrendData}
            margin={{
              top: 10, right: 10, left: 0, bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#24339a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#24339a" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8a91a7", fontSize: 12 }}
            />
            <YAxis hide domain={[60, 100]} />
            <Tooltip content={<TaskTooltip />} />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#24339a"
              strokeWidth={2.5}
              fill="url(#areaGrad)"
              dot={false}
              activeDot={{ r: 5, fill: "#24339a" }}
              isAnimationActive={animated}
              animationDuration={1600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Employee performance table */}
      <div className={`rpt-card rpt-card--table ${animated ? "rpt-card--in" : ""}`}>
        <h2
          className="rpt-card-title"
          style={{ marginBottom: 20 }}
        >
          Employee Performance Summary
        </h2>
        <div className="rpt-table-wrap">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Avg. Check-in</th>
                <th>Tasks Completed</th>
                <th>Attendance %</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, i) => (
                <tr
                  key={e.name}
                  className={animated ? "rpt-row-in" : ""}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <td>
                    <div className="rpt-emp">
                      <div className="rpt-emp-avatar">{e.initials}</div>
                      <div>
                        <p className="rpt-emp-name">{e.name}</p>
                        <p className="rpt-emp-role">{e.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="rpt-td-center">{e.checkin}</td>
                  <td className="rpt-td-center rpt-td-bold">{e.tasks}</td>
                  <td>
                    <div className="rpt-att-wrap">
                      <span className="rpt-att-pct">{e.attendance}%</span>
                      <div className="rpt-att-bar">
                        <div
                          className="rpt-att-fill"
                          style={{
                            width: animated ? `${e.attendance}%` : "0%",
                            background: attendanceColor(e.attendance),
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="rpt-td-center">
                    <span className={`rpt-perf-badge ${e.perfClass}`}>{e.perf}</span>
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
