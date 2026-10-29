// Small browser helpers shared by the landing and login pages.

// Same key as components/ThemeProvider, so the dashboard and these pages share one choice.
export const THEME_KEY = "wk-theme";

export function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Flips light / dark. With no saved choice the page follows the system setting,
// so the first click switches away from whatever the system shows.
export function toggleTheme(root = document.documentElement) {
  const systemDark = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme || (systemDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage can be blocked (private mode); the theme still switches for this visit.
  }
  return next;
}

// Counts a number up to its data-to value. The landing page counts linearly and never
// shows 0 on the way up; the login panel waits a moment and eases out.
export function countUp(node, { duration = 900, delay = 0, eased = false } = {}) {
  const to = Number(node.dataset.to) || 0;
  if (to === 0 || prefersReducedMotion()) {
    node.textContent = String(to); // eslint-disable-line no-param-reassign -- DOM node
    return;
  }
  const start = performance.now() + delay;
  const step = (now) => {
    const p = Math.min(Math.max((now - start) / duration, 0), 1);
    const value = eased ? Math.round(to * (1 - (1 - p) ** 3)) : Math.max(1, Math.round(to * p));
    node.textContent = String(value); // eslint-disable-line no-param-reassign -- DOM node
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
