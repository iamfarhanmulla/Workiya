"use client";

import { useState, useEffect } from "react";

export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("wk_user");
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  return user;
}

export function saveCurrentUser(user) {
  try {
    localStorage.setItem("wk_user", JSON.stringify(user));
  } catch {}
}

export function clearCurrentUser() {
  try {
    localStorage.removeItem("wk_user");
  } catch {}
}

export function getInitials(user) {
  if (!user) return "?";
  const f = user.firstName?.[0] || "";
  const l = user.lastName?.[0] || "";
  if (f || l) return (f + l).toUpperCase();
  return user.email?.[0]?.toUpperCase() || "?";
}

export function getDisplayName(user) {
  if (!user) return "";
  if (user.displayName) return user.displayName;
  const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return name || user.email || "";
}
