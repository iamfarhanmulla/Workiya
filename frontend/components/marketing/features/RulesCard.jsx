"use client";

import CardText from "./CardText";

// on: switched on when the card first shows. delay: when, so they flip one after another.
const RULES = [
  { label: "Must be near the location (GPS)", on: true, delay: ".3s" },
  { label: "At least one photo", on: true, delay: ".6s" },
  { label: "Notes before check-out", on: false, delay: ".9s" },
  { label: "Notify manager on every visit", on: true, delay: "1.2s" },
];

// The switches are flipped on by the swipe (see activate in useFeatureSwipe), so their
// state lives on the DOM, not in React. This card never re-renders.
function flip(e) {
  const s = e.currentTarget;
  s.style.setProperty("--t", "0s");
  s.setAttribute("aria-checked", String(s.getAttribute("aria-checked") !== "true"));
}

export default function RulesCard() {
  return (
    <article className="hcard" data-head="0">
      <CardText
        num="03"
        label="Rules"
        from="#FFC46B"
        to="#E08A12"
        title="Check-in rules you control"
        text={"Decide what counts as a real visit: GPS distance, photos, notes. Reps can't check"
          + " in from home."}
        ticks={[
          "Set the allowed GPS distance",
          "Make photos or notes required",
          "Change the rules any time",
        ]}
      />
      <div className="hc-vis">
        <div className="ui">
          <div className="ui-top">Check-in rules <span className="chipbtn">Save</span></div>
          {RULES.map((r) => (
            <div key={r.label} className="tg">
              {r.label}
              <button
                className="sw"
                type="button"
                role="switch"
                aria-checked="false"
                aria-label={r.label}
                data-on={r.on ? "1" : undefined}
                style={{ "--t": r.delay }}
                onClick={flip}
              />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
