import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  FakeIntersectionObserver, installBrowserStubs, REDUCED_MOTION, STACKED,
} from "@/test-utils/browserStubs";
import CheckInCard from "./CheckInCard";
import FeatureSwipe from "./FeatureSwipe";
import ManagerCard from "./ManagerCard";
import PlanCard from "./PlanCard";
import ReviewCard from "./ReviewCard";
import RulesCard from "./RulesCard";

function renderSection() {
  return render(
    <FeatureSwipe>
      <PlanCard />
      <CheckInCard />
      <RulesCard />
      <ReviewCard />
      <ManagerCard />
    </FeatureSwipe>,
  );
}

function cards(container) {
  return [...container.querySelectorAll(".hcard")];
}

describe("FeatureSwipe", () => {
  beforeEach(() => {
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
      fn(0);
      return 1;
    });
    window.scrollTo = jest.fn();
  });

  afterEach(() => jest.restoreAllMocks());

  it("stacks the cards on small screens and plays each one as it scrolls in", () => {
    // Arrange
    installBrowserStubs({ media: { [STACKED]: true, [REDUCED_MOTION]: true } });
    const { container } = renderSection();

    // Act
    act(() => FakeIntersectionObserver.fireAll(true));

    // Assert
    expect(container.querySelector(".hs")).not.toHaveClass("pinned");
    cards(container).forEach((card) => expect(card).toHaveClass("in"));
    const photo = screen.getByRole("switch", { name: "At least one photo" });
    const notes = screen.getByRole("switch", { name: "Notes before check-out" });
    expect(photo).toHaveAttribute("aria-checked", "true");
    expect(notes).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("142")).toBeInTheDocument();
  });

  it("pins on large screens and shows the first card with the features title", () => {
    // Arrange
    installBrowserStubs();

    // Act
    const { container } = renderSection();

    // Assert
    const section = container.querySelector(".hs");
    expect(section).toHaveClass("pinned");
    expect(section.style.height).toBe("440vh");
    expect(cards(container)[0]).toHaveClass("on", "in");
    expect(cards(container)[1].inert).toBe(true);
    expect(screen.getByRole("button", { name: "Plan" })).toHaveAttribute("aria-current", "step");
    expect(container.querySelector(".mgr-title")).toHaveClass("off");
  });

  it("scrolls to a card when its tab is clicked", async () => {
    // Arrange
    installBrowserStubs();
    renderSection();
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: "Manager view" }));

    // Assert
    expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }));
  });

  it("lets the user flip a rule switch", async () => {
    // Arrange
    installBrowserStubs({ media: { [STACKED]: true } });
    renderSection();
    const user = userEvent.setup();
    const toggle = screen.getByRole("switch", { name: "Notes before check-out" });

    // Act
    await user.click(toggle);

    // Assert
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("unpins and clears its height when it unmounts", () => {
    // Arrange
    installBrowserStubs();
    const { container, unmount } = renderSection();
    const section = container.querySelector(".hs");

    // Act
    unmount();

    // Assert
    expect(section).not.toHaveClass("pinned");
    expect(section.style.height).toBe("");
  });
});
