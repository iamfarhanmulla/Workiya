import { installBrowserStubs, REDUCED_MOTION, SYSTEM_DARK } from "@/test-utils/browserStubs";
import {
  countUp, prefersReducedMotion, THEME_KEY, toggleTheme,
} from "./motion";

function counter(to) {
  const node = document.createElement("span");
  node.dataset.to = String(to);
  node.textContent = "0";
  return node;
}

describe("toggleTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  it("switches away from a light system theme and saves the choice", () => {
    // Arrange
    installBrowserStubs();

    // Act
    const next = toggleTheme();

    // Assert
    expect(next).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("switches away from a dark system theme", () => {
    // Arrange
    installBrowserStubs({ media: { [SYSTEM_DARK]: true } });

    // Act
    const next = toggleTheme();

    // Assert
    expect(next).toBe("light");
  });

  it("flips an explicit choice back", () => {
    // Arrange
    installBrowserStubs();
    document.documentElement.setAttribute("data-theme", "dark");

    // Act
    const next = toggleTheme();

    // Assert
    expect(next).toBe("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("still switches when storage is blocked", () => {
    // Arrange
    installBrowserStubs();
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    // Act
    const next = toggleTheme();

    // Assert
    expect(next).toBe("dark");
    setItem.mockRestore();
  });
});

describe("countUp", () => {
  let frames;

  beforeEach(() => {
    frames = [];
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => frames.push(fn));
    jest.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => jest.restoreAllMocks());

  function runFrame(time) {
    const pending = frames;
    frames = [];
    pending.forEach((fn) => fn(time));
  }

  it("counts up linearly and never shows 0 on the way", () => {
    // Arrange
    installBrowserStubs();
    const node = counter(128);

    // Act
    countUp(node);
    runFrame(0);
    const first = node.textContent;
    runFrame(900);

    // Assert
    expect(first).toBe("1");
    expect(node.textContent).toBe("128");
    expect(frames).toHaveLength(0);
  });

  it("eases out after a delay", () => {
    // Arrange
    installBrowserStubs();
    const node = counter(96);

    // Act
    countUp(node, { duration: 1400, delay: 600, eased: true });
    runFrame(300);
    const waiting = node.textContent;
    runFrame(2000);

    // Assert
    expect(waiting).toBe("0");
    expect(node.textContent).toBe("96");
  });

  it("shows the final number at once with reduced motion, or for zero", () => {
    // Arrange
    installBrowserStubs({ media: { [REDUCED_MOTION]: true } });
    const reduced = counter(24);
    const zero = counter(0);

    // Act
    countUp(reduced);
    countUp(zero);

    // Assert
    expect(reduced.textContent).toBe("24");
    expect(zero.textContent).toBe("0");
    expect(prefersReducedMotion()).toBe(true);
  });
});
