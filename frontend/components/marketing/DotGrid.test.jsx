import { render } from "@testing-library/react";
import { installBrowserStubs, LIVE_DOTS } from "@/test-utils/browserStubs";
import DotGrid from "./DotGrid";
import startDotGrid from "./dotGridCanvas";

const mockStop = jest.fn();
jest.mock("./dotGridCanvas", () => ({ __esModule: true, default: jest.fn(() => mockStop) }));

describe("DotGrid", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows still dots for touch screens and reduced motion", () => {
    // Arrange
    installBrowserStubs();

    // Act
    const { container } = render(<DotGrid />);

    // Assert
    expect(container.querySelector(".gridbg")).toBeInTheDocument();
    expect(startDotGrid).not.toHaveBeenCalled();
  });

  it("starts the moving grid for mouse users and stops it on unmount", () => {
    // Arrange
    installBrowserStubs({ media: { [LIVE_DOTS]: true } });

    // Act
    const { container, unmount } = render(<DotGrid gap={22} />);
    unmount();

    // Assert
    expect(container.querySelector("canvas")).toBeNull();
    expect(startDotGrid).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      { gap: 22, radius: 140, push: 30 },
    );
    expect(mockStop).toHaveBeenCalled();
  });
});
