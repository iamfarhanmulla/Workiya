"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./motion";

const PROMISE = "Field work is hard to see. WorKiya makes every visit visible, so good reps get"
  + " credit for their work and managers stop guessing who was really out there.";
// Each word keeps its trailing space, so the quote reads normally to screen readers.
const WORDS = PROMISE.split(" ").map((w, k, all) => (k < all.length - 1 ? `${w} ` : w));

/** The promise lights up word by word as it scrolls up the screen. */
export default function PromiseQuote() {
  const ref = useRef(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    const reduce = prefersReducedMotion();
    const update = () => {
      const r = ref.current.getBoundingClientRect();
      const h = window.innerHeight;
      const p = reduce ? 1 : Math.min(Math.max((h * 0.85 - r.top) / (h * 0.5), 0), 1);
      setLit(Math.round(p * WORDS.length));
    };
    const first = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <blockquote ref={ref}>
      {WORDS.map((word, k) => (
        // eslint-disable-next-line react/no-array-index-key -- words repeat ("and", "the")
        <span key={k} className={k < lit ? "lit" : undefined}>{word}</span>
      ))}
    </blockquote>
  );
}
