"use client";

import { useEffect, useState } from "react";
import StatCard from "./StatCard";

function buildCards(items, total, plural) {
  const activeCount = items.filter((a) => a.isActive).length;
  const unassigned = items.filter((a) => !(a.assignedUsers || []).length).length;
  const cities = new Set(items.map((a) => a.city).filter(Boolean)).size;
  return [
    {
      icon: "medical_services",
      bg: "#ECFEFF",
      color: "#06B6D4",
      label: `Total ${plural}`,
      value: total,
      sub: "Matching the filters",
    },
    {
      icon: "check_circle",
      bg: "#D1FAE5",
      color: "#10B981",
      label: `Active ${plural}`,
      value: activeCount,
      sub: "On this page",
    },
    {
      icon: "person_off",
      bg: "#FEE2E2",
      color: "#EF4444",
      label: "Unassigned",
      value: unassigned,
      sub: "No rep, on this page",
    },
    {
      icon: "location_city",
      bg: "#EEF2FF",
      color: "#6366F1",
      label: "Cities Covered",
      value: cities,
      sub: "On this page",
    },
  ];
}

// Total comes from the server; the other figures describe the page being shown.
export default function AccountStats({ items, total, plural }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setActive(true), 60);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="stat-cards">
      {buildCards(items, total, plural).map((card, i) => (
        <StatCard
          key={card.label}
          icon={card.icon}
          bg={card.bg}
          color={card.color}
          label={card.label}
          value={card.value}
          sub={card.sub}
          index={i}
          active={active}
        />
      ))}
    </div>
  );
}
