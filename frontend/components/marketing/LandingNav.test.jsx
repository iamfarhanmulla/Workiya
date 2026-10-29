import {
  act, fireEvent, render, screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installBrowserStubs } from "@/test-utils/browserStubs";
import LandingNav from "./LandingNav";

describe("LandingNav", () => {
  beforeEach(() => {
    installBrowserStubs();
    jest.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
      fn(0);
      return 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.scrollY = 0;
  });

  it("links to the login page and the page sections", () => {
    // Arrange
    const sections = ["Features", "Industries", "Why WorKiya", "Contact"];

    // Act
    render(<LandingNav />);

    // Assert
    const main = screen.getByRole("navigation", { name: "Main" });
    sections.forEach((name) => expect(main).toHaveTextContent(name));
    screen.getAllByRole("link", { name: "Log in" }).forEach((a) => {
      expect(a).toHaveAttribute("href", "/login");
    });
  });

  it("opens and closes the mobile menu", async () => {
    // Arrange
    render(<LandingNav />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Open menu" });

    // Act
    await user.click(button);
    const opened = button.getAttribute("aria-expanded");
    await user.click(screen.getAllByRole("link", { name: "Features" })[1]);

    // Assert
    expect(opened).toBe("true");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("frosts the bar once the page scrolls", () => {
    // Arrange
    const { container } = render(<LandingNav />);

    // Act
    act(() => {
      window.scrollY = 200;
      fireEvent.scroll(window);
    });

    // Assert
    expect(container.querySelector(".nav")).toHaveClass("scrolled");
  });
});
