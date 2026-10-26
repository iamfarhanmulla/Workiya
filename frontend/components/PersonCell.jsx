import { initials } from "@/lib/format";

// Avatar initials, a name and an optional second line (email, city…).
export default function PersonCell({
  name, sub, square = false, tone = "",
}) {
  const shape = square ? " wk-avatar--square" : "";
  const color = tone ? ` wk-avatar--${tone}` : "";
  return (
    <div className="wk-person">
      <span className={`wk-avatar${color}${shape}`} aria-hidden="true">{initials(name)}</span>
      <div style={{ minWidth: 0 }}>
        <div className="wk-person-name">{name}</div>
        {sub && <div className="wk-person-meta">{sub}</div>}
      </div>
    </div>
  );
}

export function ActiveState({ isActive }) {
  return (
    <span className={`wk-state${isActive ? " wk-state--active" : ""}`}>
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
