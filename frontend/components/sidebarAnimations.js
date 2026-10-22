// GSAP animations for the sidebar: entry reveal, collapse/expand and nav icon feedback.
import { gsap } from "gsap";

const COLLAPSIBLE_TEXT = [
  ".sb-label",
  ".sb-badge",
  ".sb-section-label",
  ".sb-plan-text",
  ".dash-logo-name",
  ".dash-logo-sub",
].join(", ");

export const EXPANDED_W = 220;
const COLLAPSED_W = 64;

// ── Entry reveal ──
export function revealSidebar(sb, toggle, planFill) {
  const items = sb.querySelectorAll(".sb-item");
  const slabels = sb.querySelectorAll(".sb-section-label");
  const plan = sb.querySelector(".sb-plan");
  const reveal = {
    x: 0, opacity: 1, duration: 0.38, ease: "power3.out",
  };

  gsap.fromTo(
    sb,
    { clipPath: "inset(0 100% 0 0)", x: -20 },
    {
      clipPath: "inset(0 0% 0 0)", x: 0, duration: 0.6, ease: "power3.out",
    },
  );
  gsap.fromTo(slabels, { x: -12, opacity: 0 }, { ...reveal, stagger: 0.055, delay: 0.32 });
  gsap.fromTo(items, { x: -16, opacity: 0 }, { ...reveal, stagger: 0.04, delay: 0.35 });
  gsap.fromTo(
    toggle,
    { opacity: 0, scale: 0.6 },
    {
      opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)", delay: 0.5,
    },
  );
  if (plan) {
    gsap.fromTo(
      plan,
      { y: 12, opacity: 0 },
      {
        y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.4)", delay: 0.62,
      },
    );
  }
  if (planFill) {
    gsap.to(planFill, {
      width: "72%", duration: 1.3, ease: "power2.out", delay: 0.88,
    });
  }
}

function collapseElements({
  sb, wrapper, textEls, plan, togIcon, logoMark,
}) {
  gsap.to(textEls, {
    opacity: 0, x: -8, duration: 0.15, ease: "power2.in",
  });
  gsap.to(plan, {
    opacity: 0,
    scaleY: 0.7,
    duration: 0.18,
    ease: "power2.in",
    onComplete: () => gsap.set(plan, { display: "none" }),
  });
  gsap.to([sb, wrapper], { width: COLLAPSED_W, duration: 0.38, ease: "power3.inOut" });
  gsap.to(togIcon, { rotation: 180, duration: 0.35, ease: "back.out(1.5)" });
  gsap.to(logoMark, {
    marginLeft: "auto", marginRight: "auto", duration: 0.38, ease: "power3.inOut",
  });
}

function expandElements({
  sb, wrapper, textEls, plan, togIcon, logoMark,
}) {
  gsap.to([sb, wrapper], { width: EXPANDED_W, duration: 0.4, ease: "power3.inOut" });
  gsap.to(logoMark, {
    marginLeft: 0, marginRight: 0, duration: 0.38, ease: "power3.inOut",
  });
  gsap.set(plan, { display: "block" });
  gsap.to(plan, {
    opacity: 1, scaleY: 1, duration: 0.35, ease: "back.out(1.7)", delay: 0.22,
  });
  gsap.to(textEls, {
    opacity: 1, x: 0, duration: 0.28, ease: "power3.out", stagger: 0.015, delay: 0.2,
  });
  gsap.to(togIcon, { rotation: 0, duration: 0.35, ease: "back.out(1.5)" });
}

// ── Collapse / Expand ──
export function animateToggle(collapse, sb, wrapper, toggle) {
  const els = {
    sb,
    wrapper,
    textEls: sb.querySelectorAll(COLLAPSIBLE_TEXT),
    plan: sb.querySelector(".sb-plan"),
    togIcon: toggle.querySelector(".sb-toggle-icon"),
    logoMark: sb.querySelector(".sb-logo-mark"),
  };
  if (collapse) collapseElements(els);
  else expandElements(els);

  // bounce toggle
  gsap.fromTo(toggle, { scale: 0.78 }, { scale: 1, duration: 0.4, ease: "back.out(2.5)" });
}

export function handleNavClick(e) {
  const icon = e.currentTarget.querySelector(".sb-icon");
  gsap.fromTo(
    icon,
    { scale: 0.72, rotate: -10 },
    {
      scale: 1, rotate: 0, duration: 0.45, ease: "back.out(2.8)",
    },
  );
}

function scaleIcon(e, scale) {
  gsap.to(e.currentTarget.querySelector(".sb-icon"), { scale, duration: 0.18, ease: "power2.out" });
}

export const onEnter = (e) => scaleIcon(e, 1.12);
export const onLeave = (e) => scaleIcon(e, 1);
