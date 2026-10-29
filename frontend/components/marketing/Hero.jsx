"use client";

import { useEffect, useState } from "react";
import DotGrid from "./DotGrid";
import { ArrowRight } from "./icons";
import { prefersReducedMotion } from "./motion";

const rep = (initials, from, to, tag) => ({
  initials, from, to, tag,
});
// Floating sample reps around the headline. Illustration only, not real people.
const REPS = [
  rep("RK", "#5B9BFF", "#2756E0", "Rahul checked in · 18 m"),
  rep("SA", "#7BE0A0", "#1E9E55", "Sana added 3 photos"),
  rep("VP", "#B39BFF", "#6A4BEA", "Visit approved"),
  rep("NJ", "#FFC46B", "#E08A12", "Neha is on the way"),
];

// Each rep "speaks" in turn: its tag pops up for 2.2s, then the next one's does.
function useTalkingRep() {
  const [talking, setTalking] = useState(-1);
  useEffect(() => {
    const reduce = prefersReducedMotion();
    let next = 0;
    let timer;
    const talk = () => {
      setTalking(next);
      next = (next + 1) % REPS.length;
      if (!reduce) timer = setTimeout(talk, 2200);
    };
    timer = setTimeout(talk, 1800);
    return () => clearTimeout(timer);
  }, []);
  return talking;
}

function Rep({ person, n, talking }) {
  return (
    <div className={`rep r${n}${talking ? " talk" : ""}`} aria-hidden="true">
      <div className="av" style={{ "--a": person.from, "--b": person.to }}>{person.initials}</div>
      <svg className="cur" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 3l16 7-7 2.5L10.5 20 4 3Z" />
      </svg>
      <span className="tag"><i />{person.tag}</span>
    </div>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export default function Hero() {
  const talking = useTalkingRep();
  return (
    <section className="hero">
      <DotGrid />
      <div className="wrap">
        <div className="hero-center">
          {REPS.map((person, k) => (
            <Rep key={person.initials} person={person} n={k + 1} talking={talking === k} />
          ))}
          <span className="badge rise" style={{ "--i": 0 }}><Bolt />Built for field teams</span>
          <h1 className="rise" style={{ "--i": 1 }}>
            One app to <span className="hl">verify</span> every field visit
          </h1>
          <p className="lead rise" style={{ "--i": 2 }}>
            WorKiya helps medical reps, sales teams and service engineers plan their day, check in
            by GPS and report with photos, so managers see real work, not guesses.
          </p>
          <div className="ctas rise" style={{ "--i": 3 }}>
            <a className="btn btn-dark" href="#contact">Book a demo <ArrowRight /></a>
            <a className="btn btn-white" href="#features">See features</a>
          </div>
        </div>
      </div>
    </section>
  );
}
