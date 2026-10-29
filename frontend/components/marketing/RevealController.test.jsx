import { act, render } from "@testing-library/react";
import {
  FakeIntersectionObserver, installBrowserStubs, REDUCED_MOTION,
} from "@/test-utils/browserStubs";
import RevealController from "./RevealController";

function Page() {
  return (
    <div className="wkm-landing">
      <div className="reveal" data-testid="block"><span className="count" data-to="3">0</span></div>
      <RevealController />
    </div>
  );
}

describe("RevealController", () => {
  it("reveals a block and starts its counter when it scrolls into view", () => {
    // Arrange
    installBrowserStubs({ media: { [REDUCED_MOTION]: true } });
    const { getByTestId } = render(<Page />);

    // Act
    act(() => FakeIntersectionObserver.fireAll(true));

    // Assert
    expect(document.documentElement).toHaveClass("js");
    expect(getByTestId("block")).toHaveClass("in");
    expect(getByTestId("block")).toHaveTextContent("3");
  });

  it("leaves blocks hidden while they are off screen", () => {
    // Arrange
    installBrowserStubs();
    const { getByTestId } = render(<Page />);

    // Act
    act(() => FakeIntersectionObserver.fireAll(false));

    // Assert
    expect(getByTestId("block")).not.toHaveClass("in");
  });
});
