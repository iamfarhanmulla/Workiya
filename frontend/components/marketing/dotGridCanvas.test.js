import { installBrowserStubs } from "@/test-utils/browserStubs";
import startDotGrid from "./dotGridCanvas";

const RECT = {
  left: 0, top: 0, right: 200, bottom: 120, width: 200, height: 120,
};

function fakeContext() {
  return {
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    fillRect: jest.fn(),
    createRadialGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  };
}

function setup() {
  installBrowserStubs();
  const host = document.createElement("div");
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  document.body.appendChild(host);
  jest.spyOn(host, "getBoundingClientRect").mockReturnValue(RECT);
  const ctx = fakeContext();
  jest.spyOn(canvas, "getContext").mockReturnValue(ctx);
  let frames = [];
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    frames.push(fn);
    return frames.length;
  });
  jest.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  const runFrames = (n) => {
    for (let k = 0; k < n; k += 1) {
      const pending = frames;
      frames = [];
      pending.forEach((fn) => fn(k * 16));
    }
  };
  return {
    host, canvas, ctx, runFrames,
  };
}

describe("startDotGrid", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("draws the resting grid sized to its parent", () => {
    // Arrange
    const { canvas, ctx, runFrames } = setup();

    // Act
    const stop = startDotGrid(canvas, { gap: 40 });
    runFrames(1);

    // Assert
    expect(canvas.style.width).toBe("200px");
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    stop();
  });

  it("lights and pushes dots near the cursor, then lets them settle", () => {
    // Arrange
    const { canvas, ctx, runFrames } = setup();
    const stop = startDotGrid(canvas, { gap: 20 });
    runFrames(1);

    // Act
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 60 }));
    runFrames(3);
    const glowCalls = ctx.createRadialGradient.mock.calls.length;
    document.dispatchEvent(new MouseEvent("pointerleave"));
    runFrames(200);

    // Assert
    expect(glowCalls).toBeGreaterThan(0);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(glowCalls);
    stop();
  });

  it("ignores the cursor once stopped", () => {
    // Arrange
    const { canvas, ctx, runFrames } = setup();
    const stop = startDotGrid(canvas);
    runFrames(1);

    // Act
    stop();
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100, clientY: 60 }));
    runFrames(2);

    // Assert
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it("does nothing without a 2D context", () => {
    // Arrange
    const { canvas } = setup();
    canvas.getContext.mockReturnValue(null);

    // Act
    const stop = startDotGrid(canvas);

    // Assert
    expect(stop).toEqual(expect.any(Function));
    expect(() => stop()).not.toThrow();
  });
});
