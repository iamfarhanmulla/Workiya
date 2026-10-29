"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock } from "./icons";
import { countUp, prefersReducedMotion } from "./motion";

const ROUTE = "M60 280 C 120 280, 130 200, 200 190 S 300 240, 340 180 S 430 110, 500 120";
const PINS = [["p1", 60, 280], ["p2", 200, 190], ["p3", 340, 180]];
const MAIN_ROADS = [
  "M-10 280 H580", "M-10 150 C150 160 300 120 580 140",
  "M200 -10 V390", "M400 -10 C380 140 420 250 390 390",
];
const SIDE_ROADS = [
  "M-10 220 H580", "M-10 80 H580", "M-10 340 H580",
  "M100 -10 V390", "M300 -10 V390", "M490 -10 V390",
];
// Buildings as [x, y, width, height].
const BLOCKS = [
  [215, 165, 70, 45], [415, 160, 60, 50], [110, 170, 80, 40], [310, 230, 70, 38],
  [20, 95, 70, 40], [310, 30, 75, 40], [120, 295, 70, 36], [420, 300, 60, 30],
];

// Sample visits for the rotating card. Illustration only, not customer data.
const sampleVisit = (title, sub, dist, time, photos) => ({
  title, sub, dist, time, photos,
});
export const VISITS = [
  sampleVisit("Dr. Mehta Clinic", "Andheri West · 10:42 AM", "18 m", "24 min", "2"),
  sampleVisit("City Care Pharmacy", "Bandra · 11:30 AM", "9 m", "12 min", "3"),
  sampleVisit("Sunrise Hospital", "Powai · 12:15 PM", "26 m", "41 min", "4"),
];

function VisitPin({ cls, x, y }) {
  return (
    <g className={`pin ${cls}`}>
      <circle cx={x} cy={y} r="14" fill="#2FB560" opacity=".25" className="pulse" />
      <path d={`M${x} ${y} c-9-10-13-16-13-22a13 13 0 0 1 26 0c0 6-4 12-13 22Z`} fill="#2FB560" />
      <path
        d={`m${x - 6} ${y - 22} 4 4 7-8`}
        stroke="#fff"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

function StreetMap() {
  return (
    <svg viewBox="0 0 560 380">
      <defs>
        <linearGradient id="wkm-route" x1="0" x2="1">
          <stop offset="0" stopColor="#7BE0A0" />
          <stop offset="1" stopColor="#5B9BFF" />
        </linearGradient>
      </defs>
      <g stroke="rgba(255,255,255,.07)" strokeWidth="14" fill="none" strokeLinecap="round">
        {MAIN_ROADS.map((d) => <path key={d} d={d} />)}
      </g>
      <g stroke="rgba(255,255,255,.04)" strokeWidth="6" fill="none">
        {SIDE_ROADS.map((d) => <path key={d} d={d} />)}
      </g>
      <g fill="rgba(255,255,255,.035)">
        {BLOCKS.map(([x, y, w, h]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="6" />
        ))}
      </g>
      <path
        d={ROUTE}
        fill="none"
        stroke="rgba(255,255,255,.12)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />
      <path
        className="route"
        pathLength="1"
        d={ROUTE}
        fill="none"
        stroke="url(#wkm-route)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {PINS.map(([cls, x, y]) => <VisitPin key={cls} cls={cls} x={x} y={y} />)}
      <circle cx="500" cy="120" r="9" fill="none" stroke="#5B9BFF" strokeWidth="2.5" />
      <circle cx="500" cy="120" r="3.5" fill="#5B9BFF" />
      <g className="me">
        <circle r="16" fill="#5B9BFF" opacity=".25" className="pulse" />
        <circle r="8" fill="#5B9BFF" stroke="#fff" strokeWidth="3" />
      </g>
    </svg>
  );
}

// Shows each sample visit for 3.5s, sliding the card out and the next one in.
function useRotatingVisit() {
  const [state, setState] = useState({ index: 0, phase: "in" });
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let swap;
    const next = (s) => ({ index: (s.index + 1) % VISITS.length, phase: "in" });
    const timer = setInterval(() => {
      setState((s) => ({ ...s, phase: "out" }));
      swap = setTimeout(() => setState(next), 350);
    }, 3500);
    return () => {
      clearInterval(timer);
      clearTimeout(swap);
    };
  }, []);
  return state;
}

function VisitCard({ visit, phase }) {
  return (
    <div className={`vcard ${phase}`} data-testid="visit-card">
      <div className="vcard-head">
        <span className="tickc"><Check stroke="#16813F" /></span>
        <div>
          <div className="vcard-title">{visit.title}</div>
          <div className="vcard-sub">{visit.sub}</div>
        </div>
        <span className="vbadge">Verified</span>
      </div>
      <div className="vstats">
        <div><span>Distance</span><strong>{visit.dist}</strong></div>
        <div><span>On site</span><strong>{visit.time}</strong></div>
        <div><span>Photos</span><strong>{visit.photos}</strong></div>
      </div>
    </div>
  );
}

/**
 * The live map: a route being walked, visits pinned as verified, two stat chips and a
 * rotating "Verified" visit card. With autoCount the chip numbers count up on mount;
 * otherwise the landing page counts them when the card comes into view.
 */
export default function MapScene({ autoCount = false }) {
  const ref = useRef(null);
  const { index, phase } = useRotatingVisit();

  useEffect(() => {
    if (!autoCount) return;
    ref.current.querySelectorAll(".count").forEach((n) => {
      countUp(n, { duration: 1400, delay: 600, eased: true });
    });
  }, [autoCount]);

  return (
    <div className="scene" ref={ref}>
      <div className="map"><StreetMap /></div>
      <div className="chip c1">
        <span className="ico" style={{ background: "rgba(123,224,160,.15)", color: "#7BE0A0" }}>
          <Check width={2.2} />
        </span>
        <div><strong className="count" data-to="128">0</strong>Visits verified today</div>
      </div>
      <div className="chip c2">
        <span className="ico" style={{ background: "rgba(91,155,255,.18)", color: "#8DB6FF" }}>
          <Clock />
        </span>
        <div><strong><span className="count" data-to="96">0</span>%</strong>On time</div>
      </div>
      <VisitCard visit={VISITS[index]} phase={phase} />
    </div>
  );
}
