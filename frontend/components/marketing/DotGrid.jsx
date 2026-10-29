"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import startDotGrid from "./dotGridCanvas";

// Only mouse users without reduced motion get the moving grid; everyone else (and the
// server render) gets the same dots as a still CSS background.
const LIVE_QUERY = "(hover: hover) and (prefers-reduced-motion: no-preference)";

function subscribe(onChange) {
  const mq = window.matchMedia(LIVE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getLive = () => window.matchMedia(LIVE_QUERY).matches;
const getServerLive = () => false;

export default function DotGrid({ gap = 26, radius = 140, push = 30 }) {
  const live = useSyncExternalStore(subscribe, getLive, getServerLive);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!live || !canvasRef.current) return undefined;
    return startDotGrid(canvasRef.current, { gap, radius, push });
  }, [live, gap, radius, push]);

  return live
    ? <canvas ref={canvasRef} className="dotgrid" aria-hidden="true" />
    : <div className="gridbg" aria-hidden="true" />;
}
