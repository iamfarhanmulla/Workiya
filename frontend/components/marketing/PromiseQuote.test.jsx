import { act, render } from "@testing-library/react";
import { installBrowserStubs, REDUCED_MOTION } from "@/test-utils/browserStubs";
import PromiseQuote from "./PromiseQuote";

describe("PromiseQuote", () => {
  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
      fn(0);
      return 1;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("reads as one sentence and lights every word with reduced motion", () => {
    // Arrange
    installBrowserStubs({ media: { [REDUCED_MOTION]: true } });

    // Act
    const { container } = render(<PromiseQuote />);

    // Assert
    const quote = container.querySelector("blockquote");
    expect(quote.textContent.startsWith("Field work is hard to see. WorKiya")).toBe(true);
    expect(quote.textContent.endsWith("who was really out there.")).toBe(true);
    expect(container.querySelectorAll("span:not(.lit)")).toHaveLength(0);
  });

  it("lights words as the quote scrolls up the screen", () => {
    // Arrange
    installBrowserStubs();
    const position = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ top: 5000 });
    const { container } = render(<PromiseQuote />);
    const before = container.querySelectorAll("span.lit").length;

    // Act
    position.mockReturnValue({ top: 0 });
    act(() => window.dispatchEvent(new Event("scroll")));

    // Assert
    expect(before).toBe(0);
    expect(container.querySelectorAll("span.lit").length).toBeGreaterThan(0);
  });
});
