"use client";

const STATS_GRID = {
  display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "16px 20px 8px",
};

function StatCard({ stat, index }) {
  return (
    <div className="stat-card dash-anim-card" style={{ "--card-delay": `${index * 0.08}s` }}>
      <div className="stat-card-top">
        <div className="stat-icon" style={{ background: stat.bg }}>
          <span
            className="material-symbols-outlined"
            style={{ color: stat.color, fontVariationSettings: "'FILL' 1" }}
          >
            {stat.icon}
          </span>
        </div>
      </div>
      <p className="stat-label">{stat.label}</p>
      <p className="stat-val">{stat.val}</p>
    </div>
  );
}

function statsFor(activities, total, plural) {
  const count = (status) => activities.filter((a) => a.status === status).length;
  return [
    {
      label: `Total ${plural}`, val: total, bg: "#EEF2FF", color: "#6366F1", icon: "task_alt",
    },
    {
      label: "Pending",
      val: count("Pending"),
      bg: "#FEF3C7",
      color: "#D97706",
      icon: "pending_actions",
    },
    {
      label: "In Progress", val: count("InProgress"), bg: "#EEF2FF", color: "#4F46E5", icon: "sync",
    },
    {
      label: "Completed",
      val: count("Completed"),
      bg: "#D1FAE5",
      color: "#10B981",
      icon: "check_circle",
    },
  ];
}

export default function ActivityHeader({
  labels, activities, total, isStaff, onAdd,
}) {
  const subtitle = `Create, assign, and track ${labels.account.toLowerCase()} `
    + `${labels.activities.toLowerCase()}`;
  return (
    <>
      <div className="page-hd dash-fade-up" style={{ "--du": "0s" }}>
        <div className="page-hd-left">
          <div className="breadcrumb">
            <span className="material-symbols-outlined">home</span>
            <span className="material-symbols-outlined">chevron_right</span>
            <span className="breadcrumb-active">{labels.activities}</span>
          </div>
          <h1 className="page-hd-title">{labels.activities}</h1>
          <p className="page-hd-sub">{subtitle}</p>
        </div>
        {isStaff && (
          <div className="page-hd-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onAdd}>
              <span className="material-symbols-outlined">add</span>
              {`New ${labels.activity}`}
            </button>
          </div>
        )}
      </div>
      <div style={STATS_GRID}>
        {statsFor(activities, total, labels.activities).map((stat, i) => (
          <StatCard key={stat.label} stat={stat} index={i} />
        ))}
      </div>
    </>
  );
}
