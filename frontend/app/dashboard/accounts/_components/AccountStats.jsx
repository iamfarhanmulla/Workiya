"use client";

import StatTile from "@/components/StatTile";

function Foot({ children }) {
  return <span className="wk-stat-foot">{children}</span>;
}

// Total comes from the server; the other figures describe the page being shown.
export default function AccountStats({ items, total, plural }) {
  const active = items.filter((a) => a.isActive).length;
  const unassigned = items.filter((a) => !(a.assignedUsers || []).length).length;
  const cities = new Set(items.map((a) => a.city).filter(Boolean)).size;
  return (
    <div className="wk-kpis">
      <StatTile icon="contacts" label={`Total ${plural}`} value={total}>
        <Foot>Matching the filters</Foot>
      </StatTile>
      <StatTile icon="check_circle" label={`Active ${plural}`} value={active}>
        <Foot>On this page</Foot>
      </StatTile>
      <StatTile
        icon="person_off"
        label="Unassigned"
        value={unassigned}
        tone={unassigned ? "danger" : undefined}
      >
        <Foot>No rep, on this page</Foot>
      </StatTile>
      <StatTile icon="location_city" label="Cities covered" value={cities}>
        <Foot>On this page</Foot>
      </StatTile>
    </div>
  );
}
