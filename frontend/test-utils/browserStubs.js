// Stand-ins for browser APIs jsdom does not have, for the landing and login page tests.
/* eslint-disable max-classes-per-file -- each fake mirrors one small browser class */

export class FakeIntersectionObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    this.targets = new Set();
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el) {
    this.targets.add(el);
  }

  unobserve(el) {
    this.targets.delete(el);
  }

  disconnect() {
    this.targets.clear();
  }

  // Reports every watched element as on (or off) screen.
  fire(isIntersecting = true) {
    this.callback([...this.targets].map((target) => ({ target, isIntersecting })));
  }

  static fireAll(isIntersecting = true) {
    FakeIntersectionObserver.instances.forEach((io) => io.fire(isIntersecting));
  }
}

export class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }

  observe() {
    this.callback([]);
  }

  disconnect() {
    this.callback = null;
  }
}

/**
 * Installs the fakes. media maps a media query string to whether it matches;
 * any query not listed does not match.
 */
export function installBrowserStubs({ media = {} } = {}) {
  FakeIntersectionObserver.instances = [];
  const listeners = [];
  window.IntersectionObserver = FakeIntersectionObserver;
  window.ResizeObserver = FakeResizeObserver;
  window.matchMedia = (query) => ({
    matches: Boolean(media[query]),
    media: query,
    addEventListener: (_type, fn) => listeners.push(fn),
    removeEventListener: (_type, fn) => {
      const k = listeners.indexOf(fn);
      if (k >= 0) listeners.splice(k, 1);
    },
  });
  return { mediaListeners: listeners };
}

export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
export const SYSTEM_DARK = "(prefers-color-scheme: dark)";
export const LIVE_DOTS = "(hover: hover) and (prefers-reduced-motion: no-preference)";
export const STACKED = "(max-width: 860px), (max-height: 640px), (prefers-reduced-motion: reduce)";
