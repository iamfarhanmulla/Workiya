"use client";

import { useEffect, useRef, useState } from "react";

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

export default function StatCard({
  icon, bg, color, label, value, sub, index, active,
}) {
  const count = useCountUp(value, active);
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
      <p className="stat-val">{active ? Math.round(count).toLocaleString() : "0"}</p>
      <p className="stat-sub">{sub}</p>
    </div>
  );
}
