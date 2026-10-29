"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu } from "./icons";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

export const SECTION_LINKS = [
  ["#features", "Features"],
  ["#labels", "Industries"],
  ["#why", "Why WorKiya"],
  ["#contact", "Contact"],
];

// True once the page has scrolled a little. Also fills the progress line at the very top.
function useScrolled(progressRef) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 30);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const share = max > 0 ? window.scrollY / max : 0;
      progressRef.current?.style.setProperty("transform", `scaleX(${share})`);
    };
    const first = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.removeEventListener("scroll", onScroll);
    };
  }, [progressRef]);
  return scrolled;
}

function MobileMenu({ open, onClose }) {
  return (
    <div className={`mobile-menu${open ? " open" : ""}`} id="wkm-mobile-menu">
      {SECTION_LINKS.map(([href, text]) => <a key={href} href={href} onClick={onClose}>{text}</a>)}
      <Link href="/login" onClick={onClose}>Log in</Link>
      <a className="btn btn-dark" href="#contact" onClick={onClose}>Book a demo</a>
    </div>
  );
}

/** Fixed top bar with a scroll progress line; it gets a frosted background once you scroll. */
export default function LandingNav() {
  const progressRef = useRef(null);
  const scrolled = useScrolled(progressRef);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="progress" ref={progressRef} />
      <header className={`nav${scrolled || open ? " scrolled" : ""}`}>
        <div className="wrap">
          <a href="#top" aria-label="WorKiya home"><Wordmark size={27} animate /></a>
          <nav className="links" aria-label="Main">
            {SECTION_LINKS.map(([href, text]) => (
              <a key={href} className="navlink" href={href}>{text}</a>
            ))}
          </nav>
          <div className="nav-right">
            <ThemeToggle />
            <Link className="btn btn-white btn-sm hide-m" href="/login">Log in</Link>
            <a className="btn btn-dark btn-sm hide-m" href="#contact">Book a demo</a>
            <button
              className="icon-btn menu-btn"
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="wkm-mobile-menu"
              onClick={() => setOpen((v) => !v)}
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <MobileMenu open={open} onClose={() => setOpen(false)} />
    </>
  );
}
