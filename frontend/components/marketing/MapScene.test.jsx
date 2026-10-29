import { act, render, screen } from "@testing-library/react";
import { installBrowserStubs, REDUCED_MOTION } from "@/test-utils/browserStubs";
import MapScene, { VISITS } from "./MapScene";

describe("MapScene", () => {
  afterEach(() => jest.useRealTimers());

  it("rotates through the sample visits", () => {
    // Arrange
    jest.useFakeTimers();
    installBrowserStubs();
    render(<MapScene />);

    // Act
    act(() => jest.advanceTimersByTime(3500));
    const leaving = screen.getByTestId("visit-card").className;
    act(() => jest.advanceTimersByTime(350));

    // Assert
    expect(leaving).toContain("out");
    expect(screen.getByText(VISITS[1].title)).toBeInTheDocument();
    expect(screen.getByTestId("visit-card")).toHaveClass("in");
  });

  it("keeps the first visit still with reduced motion and counts the chips at once", () => {
    // Arrange
    jest.useFakeTimers();
    installBrowserStubs({ media: { [REDUCED_MOTION]: true } });

    // Act
    render(<MapScene autoCount />);
    act(() => jest.advanceTimersByTime(8000));

    // Assert
    expect(screen.getByText(VISITS[0].title)).toBeInTheDocument();
    expect(screen.getByText("128")).toBeInTheDocument();
    expect(screen.getByText("96")).toBeInTheDocument();
  });
});
