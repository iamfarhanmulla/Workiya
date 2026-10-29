"use client";

import { useEffect } from "react";
import { countUp, prefersReducedMotion } from "../motion";

// Phones, short screens and reduced motion get the stacked cards instead of the swipe.
const STACKED_QUERY = "(max-width: 860px), (max-height: 640px), (prefers-reduced-motion: reduce)";
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

// Plays a card's own animation (toggles, feed, bars, counters) the first time it is shown.
export function activate(card) {
  if (card.classList.contains("in")) return;
  card.classList.add("in");
  card.querySelectorAll(".count").forEach((n) => countUp(n));
  card.querySelectorAll(".sw[data-on]").forEach((s) => s.setAttribute("aria-checked", "true"));
}

/* eslint-disable no-param-reassign -- these helpers drive the section's DOM directly, like
   the approved mockup, so scrolling never re-renders React */

// Highlights card k, plays it, shows the matching title and marks its tab.
function showCard(ui, k) {
  ui.cards.forEach((c, i) => {
    c.classList.toggle("on", i === k);
    c.inert = i !== k;
  });
  activate(ui.cards[k]);
  const head = Number(ui.cards[k].dataset.head);
  ui.titles.forEach((t, i) => {
    t.classList.toggle("off", i !== head);
    t.setAttribute("aria-hidden", String(i !== head));
  });
  ui.tabs.forEach((t, i) => t.setAttribute("aria-current", i === k ? "step" : "false"));
}

// Scales the dashboard down so the whole mock fits inside its card.
function fitBrowser(ui, pinned) {
  const { browser } = ui;
  if (!browser) return;
  if (!pinned) {
    browser.style.removeProperty("--s");
    return;
  }
  const box = ui.cards[ui.cards.length - 1];
  const s = Math.min(
    box.clientWidth / browser.offsetWidth,
    box.clientHeight / browser.offsetHeight,
    1,
  );
  browser.style.setProperty("--s", s.toFixed(3));
}

// Where the swipe is (0 = first card, n - 1 = last), from how far the section has scrolled.
// Each card holds still for a moment, then swipes to the next one.
function swipePosition(ui) {
  const r = ui.hs.getBoundingClientRect();
  const p = clamp01(-r.top / (r.height - window.innerHeight));
  const raw = p * (ui.cards.length - 1);
  const i = Math.min(Math.floor(raw), ui.cards.length - 2);
  return i + easeInOut(clamp01((raw - i - 0.2) / 0.6));
}

function moveTrack(ui, e) {
  const { cards } = ui;
  const step = cards[1].offsetLeft - cards[0].offsetLeft;
  const x = (ui.hs.clientWidth - cards[0].offsetWidth) / 2 - e * step;
  ui.track.style.transform = `translate3d(${x}px, 0, 0)`;
  ui.tabs.forEach((t, k) => t.style.setProperty("--f", clamp01(e - k + 1)));
}

function unpin(ui) {
  ui.track.style.transform = "";
  ui.cards.forEach((c) => {
    c.inert = false;
    c.classList.remove("on");
  });
  ui.titles.forEach((t) => t.removeAttribute("aria-hidden"));
}
/* eslint-enable no-param-reassign */

function createSwipe(hs) {
  const ui = {
    hs,
    track: hs.querySelector(".hs-track"),
    cards: [...hs.querySelectorAll(".hcard")],
    tabs: [...hs.querySelectorAll(".hs-tab")],
    titles: [...hs.querySelectorAll(".hs-title")],
    browser: hs.querySelector(".browser"),
  };
  let pinned = false;
  let current = -1;

  function update() {
    if (!pinned) return;
    const e = swipePosition(ui);
    moveTrack(ui, e);
    const k = Math.round(e);
    if (k !== current) showCard(ui, k);
    current = k;
  }
  function layout(stacked) {
    pinned = !stacked;
    hs.classList.toggle("pinned", pinned);
    hs.style.setProperty("height", pinned ? `${(ui.cards.length - 1) * 85 + 100}vh` : "");
    if (!pinned) unpin(ui);
    current = -1;
    fitBrowser(ui, pinned);
    update();
  }
  // Tab k scrolls to the point where card k is centred.
  function scrollToCard(k) {
    const share = k / (ui.cards.length - 1);
    const top = hs.getBoundingClientRect().top + window.scrollY
      + share * (hs.offsetHeight - window.innerHeight);
    window.scrollTo({ top: Math.ceil(top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  return {
    ui,
    layout,
    update,
    scrollToCard,
    refit: () => fitBrowser(ui, pinned),
    isPinned: () => pinned,
  };
}

// Wires the swipe to scroll, resize, the tabs and (when stacked) per-card reveals.
function bindSwipe(swipe, mq) {
  let ticking = false;
  const relayout = () => swipe.layout(mq.matches);
  const onScroll = () => {
    if (!swipe.isPinned() || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      swipe.update();
    });
  };
  const onTab = swipe.ui.tabs.map((_, k) => () => swipe.scrollToCard(k));
  swipe.ui.tabs.forEach((t, k) => t.addEventListener("click", onTab[k]));
  const cardIo = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting && !swipe.isPinned()) activate(en.target);
  }), { threshold: 0.25 });
  swipe.ui.cards.forEach((c) => cardIo.observe(c));
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", relayout);
  mq.addEventListener("change", relayout);

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", relayout);
    mq.removeEventListener("change", relayout);
    swipe.ui.tabs.forEach((t, k) => t.removeEventListener("click", onTab[k]));
    cardIo.disconnect();
  };
}

/** Pins the features section and swipes its cards sideways as the page scrolls. */
export default function useFeatureSwipe(sectionRef) {
  useEffect(() => {
    const hs = sectionRef.current;
    if (!hs || typeof window.matchMedia !== "function") return undefined;
    const swipe = createSwipe(hs);
    const mq = window.matchMedia(STACKED_QUERY);
    const unbind = bindSwipe(swipe, mq);
    swipe.layout(mq.matches);
    if (document.fonts) document.fonts.ready.then(swipe.refit);

    return () => {
      unbind();
      swipe.layout(true);
    };
  }, [sectionRef]);
}
