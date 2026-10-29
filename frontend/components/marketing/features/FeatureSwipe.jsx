"use client";

import { useRef } from "react";
import { Bars } from "../icons";
import useFeatureSwipe from "./useFeatureSwipe";

const TABS = ["Plan", "Check in", "Rules", "Review", "Manager view"];

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {[[4, 4], [13.5, 4], [4, 13.5], [13.5, 13.5]].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="6.5" height="6.5" rx="1.5" />
      ))}
    </svg>
  );
}

function Titles() {
  return (
    <div className="wrap hs-head">
      <div className="hs-titles">
        <div className="hs-title">
          <span className="badge"><GridIcon />Features</span>
          <h2>Everything a field team needs, in one simple app</h2>
          <p>
            From the morning plan to the manager&apos;s sign-off, every step of a visit is
            planned, proven and reviewed in WorKiya.
          </p>
        </div>
        <div className="hs-title mgr-title off" aria-hidden="true">
          <span className="badge"><Bars />For managers</span>
          <h2>Your whole team&apos;s day, at a glance</h2>
          <p>
            See who&apos;s on the road, what&apos;s done and what needs your review, without
            chasing anyone on the phone.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The features section. On large screens it pins while the cards swipe sideways, and the
 * title switches to "For managers" on the last card. The cards are passed in as children.
 * This component never re-renders after mount: useFeatureSwipe drives its classes directly.
 */
export default function FeatureSwipe({ children }) {
  const ref = useRef(null);
  useFeatureSwipe(ref);

  return (
    <section className="hs" id="features" ref={ref}>
      <div className="hs-stage">
        <Titles />
        <div className="hs-track">{children}</div>
        <div className="wrap hs-foot" role="group" aria-label="Feature steps">
          {TABS.map((tab) => (
            <button key={tab} className="hs-tab" type="button">{tab}<span><i /></span></button>
          ))}
        </div>
      </div>
    </section>
  );
}
