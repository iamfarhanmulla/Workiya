"use client";

import { useEffect } from "react";
import { countUp } from "./motion";

/**
 * Fades each .reveal block in (and starts its counters) the first time it scrolls into
 * view. The blocks are only hidden while html has the "js" class, so without JavaScript
 * the page simply shows everything.
 */
export default function RevealController() {
  useEffect(() => {
    document.documentElement.classList.add("js");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        entry.target.querySelectorAll(".count").forEach((n) => countUp(n));
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    document.querySelectorAll(".wkm-landing .reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
