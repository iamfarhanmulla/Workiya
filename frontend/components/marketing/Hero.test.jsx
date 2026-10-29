import { act, render, screen } from "@testing-library/react";
import { installBrowserStubs } from "@/test-utils/browserStubs";
import Hero from "./Hero";

describe("Hero", () => {
  afterEach(() => jest.useRealTimers());

  it("shows the headline and calls to action", () => {
    // Arrange
    installBrowserStubs();

    // Act
    render(<Hero />);

    // Assert
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("One app to verify every field visit");
    expect(screen.getByRole("link", { name: /book a demo/i })).toHaveAttribute("href", "#contact");
    expect(screen.getByRole("link", { name: "See features" })).toHaveAttribute("href", "#features");
  });

  it("lets each rep speak in turn", () => {
    // Arrange
    jest.useFakeTimers();
    installBrowserStubs();
    const { container } = render(<Hero />);

    // Act
    act(() => jest.advanceTimersByTime(1800));
    const first = container.querySelector(".rep.talk");
    act(() => jest.advanceTimersByTime(2200));

    // Assert
    expect(first).toHaveClass("r1");
    expect(container.querySelector(".rep.talk")).toHaveClass("r2");
  });
});
