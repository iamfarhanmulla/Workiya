import { Bars } from "../icons";

// Sample dashboard for the "For managers" card. Illustration only, not customer data.
const KPIS = [
  ["Planned visits", 142, "↑ 8% vs last week"],
  ["Verified", 128, "90% complete"],
  ["Waiting for review", 9, "Needs you", "amber"],
  ["Reps in the field", 24, "All checked in"],
];
const WEEK = [
  ["Mon", 58], ["Tue", 72], ["Wed", 64], ["Thu", 86], ["Fri", 78], ["Sat", 44], ["Today", 92],
];
const row = (initials, color, who, note, pill, status) => ({
  initials, color, who, note, pill, status,
});
const LATEST = [
  row(
    "RK",
    "#2756E0",
    "Rahul K. · Dr. Mehta Clinic",
    "10:42 AM · 18 m away · 2 photos",
    "ok",
    "Verified",
  ),
  row(
    "SA",
    "#1E9E55",
    "Sana A. · City Care Pharmacy",
    "11:30 AM · 9 m away · 3 photos",
    "wait",
    "Review",
  ),
  row(
    "VP",
    "#7C5CFF",
    "Vikas P. · Sunrise Hospital",
    "12:15 PM · 26 m away · 4 photos",
    "ok",
    "Verified",
  ),
  row("NJ", "#E08A12", "Neha J. · Apollo Diagnostics", "Now · on the way", "go", "In progress"),
];

function WeekChart() {
  return (
    <div className="panel">
      <h5>Verified visits this week</h5>
      <div className="dchart">
        {WEEK.map(([day, h], n) => (
          <div key={day}><b style={{ "--h": `${h}%`, "--n": n }} /><small>{day}</small></div>
        ))}
      </div>
    </div>
  );
}

function LatestVisits() {
  return (
    <div className="panel">
      <h5>Latest visits</h5>
      <div className="dl">
        {LATEST.map((r, n) => (
          <div key={r.initials} className="dr" style={{ "--n": n }}>
            <span className="av" style={{ background: r.color }}>{r.initials}</span>
            <div><b>{r.who}</b><small>{r.note}</small></div>
            <span className={`pill ${r.pill}`}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  return (
    <div className="dash">
      <div className="dash-top"><h4>Good morning, Priya</h4><span>Today · West region</span></div>
      <div className="kpis">
        {KPIS.map(([label, value, note, tone]) => (
          <div key={label} className="kpi">
            <span>{label}</span>
            <strong className="count" data-to={value}>0</strong>
            <em className={tone}>{note}</em>
          </div>
        ))}
      </div>
      <div className="dash-body">
        <WeekChart />
        <LatestVisits />
      </div>
    </div>
  );
}

function BrowserBar() {
  return (
    <div className="bbar">
      <i /><i /><i />
      <div className="url">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
        app.workiya.com/dashboard
      </div>
    </div>
  );
}

export default function ManagerCard() {
  return (
    <article className="hcard mgr" data-head="1">
      <div className="mgr-head">
        <span className="badge"><Bars />For managers</span>
        <h2>Your whole team&apos;s day, at a glance</h2>
        <p>
          See who&apos;s on the road, what&apos;s done and what needs your review, without chasing
          anyone on the phone.
        </p>
      </div>
      <div className="browser" aria-hidden="true">
        <BrowserBar />
        <Dashboard />
      </div>
    </article>
  );
}
