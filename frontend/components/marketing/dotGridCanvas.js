// Interactive dot grid: dots push away from the cursor, light up green to blue and spring
// back. Draws on a canvas that fills its parent. Returns a cleanup function.

const BLUE = [91, 155, 255];
const GREEN = [123, 224, 160];

function sizeCanvas(canvas, ctx, host) {
  const r = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  /* eslint-disable no-param-reassign -- DOM node */
  canvas.width = r.width * dpr;
  canvas.height = r.height * dpr;
  canvas.style.width = `${r.width}px`;
  canvas.style.height = `${r.height}px`;
  /* eslint-enable no-param-reassign */
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w: r.width, h: r.height };
}

function makeDots(w, h, gap) {
  const dots = [];
  for (let y = (h % gap) / 2; y <= h; y += gap) {
    for (let x = (w % gap) / 2; x <= w; x += gap) {
      dots.push({
        hx: x, hy: y, x, y, vx: 0, vy: 0, t: 0,
      });
    }
  }
  return dots;
}

// Moves one dot a step towards its target (pushed away from the mouse, or home).
function stepDot(d, mouse, radius, push) {
  /* eslint-disable no-param-reassign -- the dots are mutable simulation state */
  const dx = d.hx - mouse.x;
  const dy = d.hy - mouse.y;
  const dist = Math.hypot(dx, dy);
  let tx = d.hx;
  let ty = d.hy;
  let t = 0;
  if (mouse.on && dist < radius) {
    t = 1 - dist / radius;
    const f = t * t * push;
    tx += (dx / (dist || 1)) * f;
    ty += (dy / (dist || 1)) * f;
  }
  d.vx = (d.vx + (tx - d.x) * 0.09) * 0.8;
  d.vy = (d.vy + (ty - d.y) * 0.09) * 0.8;
  d.x += d.vx;
  d.y += d.vy;
  d.t += (t - d.t) * 0.15;
  /* eslint-enable no-param-reassign */
  return Math.abs(d.vx) + Math.abs(d.vy) > 0.02 || d.t > 0.01;
}

function drawGlow(ctx, mouse, radius) {
  const glow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, radius * 1.4);
  glow.addColorStop(0, "rgba(91,155,255,0.13)");
  glow.addColorStop(1, "rgba(91,155,255,0)");
  ctx.save();
  ctx.fillStyle = glow;
  ctx.fillRect(mouse.x - radius * 1.4, mouse.y - radius * 1.4, radius * 2.8, radius * 2.8);
  ctx.restore();
}

// Green on the left of the cursor, blue on the right, brighter and bigger near it.
function drawLit(ctx, lit, mouse, radius) {
  lit.forEach((d) => {
    const k = Math.min(Math.max(((d.x - mouse.x) / radius) * 0.5 + 0.5, 0), 1);
    const c = GREEN.map((g, i) => Math.round(g + (BLUE[i] - g) * k));
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.2 + d.t * 0.8})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 1.2 + d.t * 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

// One frame: resting dots in one path, then the lit ones near the cursor. Returns true
// while anything is still moving, so the caller knows to draw another frame.
function drawDots(ctx, dots, mouse, opts) {
  const { radius, push, base } = opts;
  let moving = false;
  const lit = [];
  ctx.beginPath();
  ctx.fillStyle = `rgba(${base}, 0.15)`;
  dots.forEach((d) => {
    if (stepDot(d, mouse, radius, push)) moving = true;
    if (d.t > 0.02) {
      lit.push(d);
    } else {
      ctx.moveTo(d.x + 1.2, d.y);
      ctx.arc(d.x, d.y, 1.2, 0, Math.PI * 2);
    }
  });
  ctx.fill();
  drawLit(ctx, lit, mouse, radius);
  return moving;
}

// Follows the cursor over the host. Returns a cleanup function.
function trackMouse(host, mouse, onChange) {
  /* eslint-disable no-param-reassign -- mouse is shared mutable state */
  function onMove(e) {
    const r = host.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right
      && e.clientY >= r.top && e.clientY <= r.bottom;
    mouse.on = inside;
    mouse.x = inside ? e.clientX - r.left : -9999;
    mouse.y = inside ? e.clientY - r.top : -9999;
    onChange();
  }
  function onLeave() {
    mouse.on = false;
    mouse.x = -9999;
    mouse.y = -9999;
    onChange();
  }
  /* eslint-enable no-param-reassign */
  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  return () => {
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
  };
}

// Redraws on theme change, re-lays out on resize, pauses off screen. Returns a cleanup.
function watchHost(host, { redraw, layout, setVisible }) {
  const themeObserver = new MutationObserver(redraw);
  themeObserver.observe(document.documentElement, {
    attributes: true, attributeFilter: ["data-theme"],
  });
  const resizeObserver = new ResizeObserver(layout);
  resizeObserver.observe(host);
  const viewObserver = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
  viewObserver.observe(host);
  return () => {
    themeObserver.disconnect();
    resizeObserver.disconnect();
    viewObserver.disconnect();
  };
}

export default function startDotGrid(canvas, { gap = 26, radius = 140, push = 30 } = {}) {
  const host = canvas.parentElement;
  const ctx = canvas.getContext("2d");
  if (!host || !ctx) return () => {};
  const mouse = { x: -9999, y: -9999, on: false };
  let dots = [];
  let size = { w: 0, h: 0 };
  let raf = 0;
  let visible = true;

  function frame() {
    raf = 0;
    ctx.clearRect(0, 0, size.w, size.h);
    if (mouse.on) drawGlow(ctx, mouse, radius);
    // The resting dot colour comes from the theme (--dot), so it follows light / dark.
    const base = getComputedStyle(canvas).getPropertyValue("--dot").trim() || "16, 23, 46";
    const moving = drawDots(ctx, dots, mouse, { radius, push, base });
    // eslint-disable-next-line no-use-before-define -- kick and frame call each other
    if ((moving || mouse.on) && visible) kick();
  }
  function kick() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  const stopMouse = trackMouse(host, mouse, kick);
  const stopWatching = watchHost(host, {
    redraw: kick,
    layout: () => {
      size = sizeCanvas(canvas, ctx, host);
      dots = makeDots(size.w, size.h, gap);
      kick();
    },
    setVisible: (v) => {
      visible = v;
      kick();
    },
  });

  return () => {
    if (raf) cancelAnimationFrame(raf);
    stopMouse();
    stopWatching();
  };
}
