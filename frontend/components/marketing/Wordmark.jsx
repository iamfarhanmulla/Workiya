"use client";

import {
  useEffect, useId, useRef, useState,
} from "react";

// Works out the swoosh path and the i-dot position from where the letters actually landed.
function measure(el, em) {
  const box = el.getBoundingClientRect();
  const w = el.querySelector(".w").getBoundingClientRect();
  const a = el.querySelector(".a").getBoundingClientRect();
  const i = el.querySelector(".i").getBoundingClientRect();
  const base = w.bottom - box.top;
  const sx = w.left - box.left + 0.12 * em;
  const sy = base + 0.15 * em;
  const ex = a.right - box.left + 0.05 * em;
  const ey = base + 0.01 * em;
  const len = ex - sx;
  // Two curves: along the top edge of the swoosh to its tip, then back along the thicker belly.
  const c1 = `${sx + len * 0.4} ${sy + 0.11 * em}`;
  const c2 = `${ex - len * 0.3} ${ey + 0.12 * em}`;
  const c3 = `${ex - len * 0.18} ${ey + 0.3 * em}`;
  const c4 = `${sx + len * 0.4} ${sy + 0.2 * em}`;
  const dot = 0.155 * em;
  return {
    d: `M${sx} ${sy} C${c1} ${c2} ${ex} ${ey} C${c3} ${c4} ${sx} ${sy + 0.012 * em} Z`,
    width: box.width + em * 0.1,
    height: box.height + em * 0.3,
    dot: { size: dot, left: i.left - box.left + i.width / 2 - dot / 2, top: base - 0.74 * em },
  };
}

// The W with the green tick for its last stroke.
function TickW({ uid }) {
  return (
    <svg
      className="w"
      viewBox="0 -40 104 110"
      style={{ width: "1.04em", height: "1.1em" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`tg${uid}`} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor="#2FB560" />
          <stop offset="1" stopColor="#7BE0A0" />
        </linearGradient>
      </defs>
      <polyline
        points="9,9 28,61 47,20 66,61"
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        className="tick"
        pathLength="1"
        points="66,61 98,-30"
        fill="none"
        stroke={`url(#tg${uid})`}
        strokeWidth="16"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The tapered blue swoosh under the word and the green dot on the i.
function SwooshAndDot({ shape, uid }) {
  const { dot } = shape;
  return (
    <>
      <svg className="swoosh" width={shape.width} height={shape.height} aria-hidden="true">
        <defs>
          <linearGradient id={`sg${uid}`} x1="0" x2="1">
            <stop offset="0" stopColor="#A9C8FF" />
            <stop offset="1" stopColor="#2756E0" />
          </linearGradient>
        </defs>
        <path d={shape.d} fill={`url(#sg${uid})`} />
      </svg>
      <span
        className="dot"
        style={{
          width: dot.size, height: dot.size, left: dot.left, top: dot.top,
        }}
      />
    </>
  );
}

/**
 * The WorKiya logo: tick W, blue K, green i dot and a tapered blue swoosh.
 * The swoosh and dot are placed after the fonts load, so they sit right at any size.
 */
export default function Wordmark({
  size, animate = false, light = false, label = "WorKiya",
}) {
  const ref = useRef(null);
  const [shape, setShape] = useState(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  useEffect(() => {
    let alive = true;
    const ready = document.fonts ? document.fonts.ready : Promise.resolve();
    ready.then(() => {
      if (alive && ref.current) setShape(measure(ref.current, size));
    });
    return () => {
      alive = false;
    };
  }, [size]);

  const className = ["wm", animate && "anim", light && "light"].filter(Boolean).join(" ");
  return (
    <span ref={ref} className={className} style={{ fontSize: size }} role="img" aria-label={label}>
      <TickW uid={uid} />
      or
      <span className="k">K</span>
      <span className="i">ı</span>
      y
      <span className="a">a</span>
      {shape && <SwooshAndDot shape={shape} uid={uid} />}
    </span>
  );
}
