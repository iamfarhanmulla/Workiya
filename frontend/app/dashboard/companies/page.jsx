"use client";

import { useState, useEffect, useMemo } from "react";

/* ── Data ─────────────────────────────────────── */
const ALL_COMPANIES = [
  { id:1,  initials:"NX", color:"#6c5ce7", name:"NexGen Solutions",    location:"San Francisco, CA", manager:"Mark Veridan",   managerInit:"MV", employees:1420, plan:"ENTERPRISE",   status:"Active"   },
  { id:2,  initials:"LP", color:"#00b894", name:"Lumina Partners",      location:"London, UK",        manager:"Sarah Jenkins",  managerInit:"SJ", employees:345,  plan:"PROFESSIONAL", status:"Active"   },
  { id:3,  initials:"SF", color:"#fdcb6e", name:"Swift Flow Inc",       location:"Berlin, DE",        manager:"Tobias Mueller", managerInit:"TM", employees:12,   plan:"STARTUP",      status:"Inactive" },
  { id:4,  initials:"AQ", color:"#0984e3", name:"Aqua Dynamics",        location:"Sydney, AU",        manager:"Emily Zhao",     managerInit:"EZ", employees:890,  plan:"ENTERPRISE",   status:"Active"   },
  { id:5,  initials:"TR", color:"#e17055", name:"Trident Robotics",     location:"Tokyo, JP",         manager:"Kenji Mori",     managerInit:"KM", employees:530,  plan:"ENTERPRISE",   status:"Active"   },
  { id:6,  initials:"VX", color:"#a29bfe", name:"Vertex Capital",       location:"New York, US",      manager:"Diana Prince",   managerInit:"DP", employees:88,   plan:"PROFESSIONAL", status:"Active"   },
  { id:7,  initials:"GM", color:"#55efc4", name:"GreenMile Logistics",  location:"Dubai, AE",         manager:"Omar Hussain",   managerInit:"OH", employees:2100, plan:"ENTERPRISE",   status:"Active"   },
  { id:8,  initials:"BL", color:"#fd79a8", name:"BlueLake Technologies",location:"Toronto, CA",       manager:"Priya Sharma",   managerInit:"PS", employees:670,  plan:"PROFESSIONAL", status:"Inactive" },
  { id:9,  initials:"OR", color:"#e84393", name:"OrbitSoft",            location:"Amsterdam, NL",     manager:"Lars Eriksson",  managerInit:"LE", employees:45,   plan:"STARTUP",      status:"Active"   },
  { id:10, initials:"PH", color:"#00cec9", name:"Phantom Analytics",    location:"Chicago, US",       manager:"Nora Kim",       managerInit:"NK", employees:310,  plan:"PROFESSIONAL", status:"Active"   },
  { id:11, initials:"CS", color:"#d63031", name:"CoreStack Systems",    location:"Mumbai, IN",        manager:"Raj Patel",      managerInit:"RP", employees:1780, plan:"ENTERPRISE",   status:"Active"   },
  { id:12, initials:"EV", color:"#6d9e25", name:"EverGreen Ventures",   location:"Cape Town, ZA",     manager:"Amara Diallo",   managerInit:"AD", employees:90,   plan:"STARTUP",      status:"Inactive" },
];

const PLANS    = ["All Plans",    "ENTERPRISE", "PROFESSIONAL", "STARTUP"];
const STATUSES = ["All Statuses", "Active", "Inactive"];
const REGIONS  = ["All Regions",  "US", "EU", "APAC", "MENA"];

const PLAN_CLASS = { ENTERPRISE: "plan-enterprise", PROFESSIONAL: "plan-professional", STARTUP: "plan-startup" };

const PAGE_SIZE = 5;

const stats = [
  { icon:"corporate_fare", label:"Total Companies",  value:"1,284", delta:"+12%", up:true,  accent:"#6c5ce7" },
  { icon:"manage_accounts", label:"Active Managers", value:"4,902", delta:"+5%",  up:true,  accent:"#0984e3" },
  { icon:"groups",          label:"Total Employees", value:"84.2k", delta:"-2%",  up:false, accent:"#00b894" },
  { icon:"payments",        label:"Monthly Revenue", value:"$2.4M", delta:"+24%", up:true,  accent:"#e17055" },
];

/* ── Animated counter ─────────────────────────── */
function useCountUp(target, active) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const num = parseFloat(target.replace(/[^0-9.]/g, ""));
    const id = requestAnimationFrame(function step(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      setVal(num * p);
      if (p < 1) requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(id);
  }, [active, target]);

  const raw = parseFloat(target.replace(/[^0-9.]/g, ""));
  const prefix = target.startsWith("$") ? "$" : "";
  const suffix = target.endsWith("k") ? "k" : target.endsWith("M") ? "M" : "";
  const display = val >= raw ? target : `${prefix}${val.toFixed(suffix ? 1 : 0)}${suffix}`;
  return display;
}

function StatCard({ icon, label, value, delta, up, accent, delay, active }) {
  const count = useCountUp(value, active);
  return (
    <div className="co-stat-card" style={{ "--accent": accent, "--delay": `${delay}s` }}>
      <div className="co-stat-top">
        <div className="co-stat-icon" style={{ background: `${accent}18` }}>
          <span className="material-symbols-outlined" style={{ color: accent, fontVariationSettings:"'FILL' 1" }}>{icon}</span>
        </div>
        <span className={`co-stat-delta ${up ? "co-delta-up" : "co-delta-down"}`}>
          <span className="material-symbols-outlined" style={{ fontSize:12 }}>{up ? "trending_up" : "trending_down"}</span>
          {delta}
        </span>
      </div>
      <p className="co-stat-label">{label}</p>
      <p className="co-stat-value">{count}</p>
      <div className="co-stat-bar" style={{ background: accent }} />
    </div>
  );
}

/* ── Dropdown ─────────────────────────────────── */
function Dropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="co-dropdown-wrap">
      <button className="co-dropdown-btn" onClick={() => setOpen(o => !o)}>
        {value}
        <span className="material-symbols-outlined" style={{ fontSize:16 }}>expand_more</span>
      </button>
      {open && (
        <ul className="co-dropdown-list">
          {options.map(o => (
            <li key={o} className={o === value ? "active" : ""} onClick={() => { onChange(o); setOpen(false); }}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Add Company Modal ────────────────────────── */
function AddModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name:"", location:"", manager:"", employees:"", plan:"STARTUP" });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function submit(e) {
    e.preventDefault();
    const initials = form.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
    const colors = ["#6c5ce7","#00b894","#0984e3","#e17055","#fd79a8","#a29bfe"];
    onAdd({
      id: Date.now(),
      initials,
      color: colors[Math.floor(Math.random() * colors.length)],
      name: form.name,
      location: form.location,
      manager: form.manager,
      managerInit: form.manager.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase(),
      employees: parseInt(form.employees) || 0,
      plan: form.plan,
      status: "Active",
    });
    onClose();
  }

  return (
    <div className="co-modal-overlay" onClick={onClose}>
      <div className="co-modal" onClick={e => e.stopPropagation()}>
        <div className="co-modal-header">
          <h2>Add New Company</h2>
          <button className="co-modal-close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="co-modal-form">
          <label>Company Name <input required value={form.name} onChange={set("name")} placeholder="e.g. Acme Corp" /></label>
          <label>Location <input required value={form.location} onChange={set("location")} placeholder="e.g. New York, US" /></label>
          <label>Admin Manager <input required value={form.manager} onChange={set("manager")} placeholder="e.g. Jane Doe" /></label>
          <label>Employees <input type="number" min="1" value={form.employees} onChange={set("employees")} placeholder="e.g. 250" /></label>
          <label>Plan
            <select value={form.plan} onChange={set("plan")}>
              <option>STARTUP</option>
              <option>PROFESSIONAL</option>
              <option>ENTERPRISE</option>
            </select>
          </label>
          <div className="co-modal-actions">
            <button type="button" className="co-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="co-btn-primary">Add Company</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────── */
export default function CompaniesPage() {
  const [companies, setCompanies] = useState(ALL_COMPANIES);
  const [plan,      setPlan]      = useState("All Plans");
  const [status,    setStatus]    = useState("All Statuses");
  const [region,    setRegion]    = useState("All Regions");
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [modal,     setModal]     = useState(false);
  const [animated,  setAnimated]  = useState(false);
  const [sortKey,   setSortKey]   = useState("name");
  const [sortDir,   setSortDir]   = useState(1);

  useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t); }, []);

  /* Filter + sort */
  const filtered = useMemo(() => {
    let list = companies.filter(c => {
      if (plan   !== "All Plans"    && c.plan   !== plan)   return false;
      if (status !== "All Statuses" && c.status !== status) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
                    !c.manager.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      return typeof av === "number" ? (av - bv) * sortDir : String(av).localeCompare(String(bv)) * sortDir;
    });
    return list;
  }, [companies, plan, status, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => -d);
    else { setSortKey(key); setSortDir(1); }
  }

  function handleAdd(company) {
    setCompanies(prev => [company, ...prev]);
    setPage(1);
  }

  function toggleStatus(id) {
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: c.status === "Active" ? "Inactive" : "Active" } : c));
  }

  function deleteCompany(id) {
    setCompanies(prev => prev.filter(c => c.id !== id));
  }

  function SortIcon({ k }) {
    if (sortKey !== k) return <span className="material-symbols-outlined co-sort-icon">unfold_more</span>;
    return <span className="material-symbols-outlined co-sort-icon co-sort-active">{sortDir === 1 ? "arrow_upward" : "arrow_downward"}</span>;
  }

  /* Pagination buttons */
  function pageNums() {
    const nums = [];
    if (totalPages <= 5) for (let i=1;i<=totalPages;i++) nums.push(i);
    else {
      nums.push(1);
      if (page > 3) nums.push("...");
      for (let i=Math.max(2,page-1);i<=Math.min(totalPages-1,page+1);i++) nums.push(i);
      if (page < totalPages - 2) nums.push("...");
      nums.push(totalPages);
    }
    return nums;
  }

  return (
    <div className="co-page">
      {/* Breadcrumb */}
      <div className="co-breadcrumb">
        <span>Admin</span>
        <span className="material-symbols-outlined" style={{ fontSize:14 }}>chevron_right</span>
        <span className="co-breadcrumb-active">Company Management</span>
      </div>

      {/* Page header */}
      <div className="co-page-header">
        <div>
          <h1 className="co-page-title">Company Management</h1>
          <p className="co-page-sub">Oversee and manage organizational access across the <strong>WorKiya</strong> ecosystem.</p>
        </div>
        <button className="co-add-btn" onClick={() => setModal(true)}>
          <span className="material-symbols-outlined">add</span>
          Add New Company
        </button>
      </div>

      {/* Stat cards */}
      <div className="co-stat-grid">
        {stats.map((s, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.08} active={animated} />
        ))}
      </div>

      {/* Filter bar */}
      <div className={`co-filter-bar ${animated ? "co-anim-in" : ""}`} style={{ "--d": "0.32s" }}>
        <div className="co-filter-left">
          <Dropdown options={PLANS}    value={plan}   onChange={v => { setPlan(v);   setPage(1); }} />
          <Dropdown options={STATUSES} value={status} onChange={v => { setStatus(v); setPage(1); }} />
          <Dropdown options={REGIONS}  value={region} onChange={v => { setRegion(v); setPage(1); }} />
        </div>
        <div className="co-filter-right">
          <div className="co-search-box">
            <span className="material-symbols-outlined">search</span>
            <input placeholder="Search companies..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <button onClick={() => setSearch("")}><span className="material-symbols-outlined">close</span></button>}
          </div>
          <button className="co-export-btn">
            <span className="material-symbols-outlined" style={{ fontSize:16 }}>download</span>
            Export
          </button>
          <button className="co-filter-btn">
            <span className="material-symbols-outlined" style={{ fontSize:16 }}>tune</span>
            More Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={`co-table-card ${animated ? "co-anim-in" : ""}`} style={{ "--d": "0.42s" }}>
        <div className="co-table-wrap">
          <table className="co-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort("name")} className="co-th-sort">COMPANY NAME <SortIcon k="name" /></th>
                <th>ADMIN MANAGER</th>
                <th onClick={() => toggleSort("employees")} className="co-th-sort">EMPLOYEES <SortIcon k="employees" /></th>
                <th onClick={() => toggleSort("plan")} className="co-th-sort">PLAN <SortIcon k="plan" /></th>
                <th onClick={() => toggleSort("status")} className="co-th-sort">STATUS <SortIcon k="status" /></th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={6} className="co-empty">No companies found.</td></tr>
              ) : pageData.map((c, i) => (
                <tr key={c.id} className="co-row" style={{ animationDelay: `${i * 0.06}s` }}>
                  <td>
                    <div className="co-company">
                      <div className="co-company-avatar" style={{ background: c.color }}>{c.initials}</div>
                      <div>
                        <p className="co-company-name">{c.name}</p>
                        <p className="co-company-loc">
                          <span className="material-symbols-outlined" style={{ fontSize:12 }}>location_on</span>
                          {c.location}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="co-manager">
                      <div className="co-manager-avatar">{c.managerInit}</div>
                      <span>{c.manager}</span>
                    </div>
                  </td>
                  <td>
                    <div className="co-emp-cell">
                      <div className="co-emp-bar-wrap">
                        <div className="co-emp-bar">
                          <div className="co-emp-fill" style={{ width:`${Math.min(100, c.employees/25)}%`, background: c.color }} />
                        </div>
                      </div>
                      <span className="co-emp-count">{c.employees.toLocaleString()}</span>
                    </div>
                  </td>
                  <td><span className={`co-plan-badge ${PLAN_CLASS[c.plan]}`}>{c.plan}</span></td>
                  <td>
                    <div className="co-status-cell">
                      <button
                        className={`co-toggle ${c.status === "Active" ? "co-toggle--on" : ""}`}
                        onClick={() => toggleStatus(c.id)}
                        title={`Toggle ${c.status}`}
                      >
                        <span className="co-toggle-thumb" />
                      </button>
                      <span className={`co-status-text ${c.status === "Active" ? "co-status-active" : "co-status-inactive"}`}>
                        <span className="co-status-dot" />
                        {c.status}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="co-actions">
                      <button className="co-action-btn" title="View">
                        <span className="material-symbols-outlined">visibility</span>
                      </button>
                      <button className="co-action-btn" title="Edit">
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button className="co-action-btn co-action-btn--danger" title="Delete" onClick={() => deleteCompany(c.id)}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="co-pagination">
          <p className="co-pagination-info">
            Showing <strong>{filtered.length === 0 ? 0 : (page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length.toLocaleString()}</strong> companies
          </p>
          <div className="co-pagination-btns">
            <button className="co-page-btn" disabled={page===1} onClick={() => setPage(p=>p-1)}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            {pageNums().map((n,i) =>
              n === "..." ? <span key={i} className="co-page-ellipsis">…</span>
              : <button key={n} className={`co-page-btn ${n===page?"co-page-btn--active":""}`} onClick={() => setPage(n)}>{n}</button>
            )}
            <button className="co-page-btn" disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {modal && <AddModal onClose={() => setModal(false)} onAdd={handleAdd} />}
    </div>
  );
}
