"use client";

import { useSelector } from "react-redux";
import { selectUser } from "@/store/authSlice";

export function useCurrentUser() {
  return useSelector(selectUser);
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
