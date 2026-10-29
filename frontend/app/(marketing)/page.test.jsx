import { render, screen, waitFor } from "@testing-library/react";
import { installBrowserStubs } from "@/test-utils/browserStubs";
import LandingPage, { metadata } from "./page";

// Renders the page and waits for the logos to place their swoosh, so no update lands late.
async function renderPage() {
  const view = render(<LandingPage />);
  await waitFor(() => expect(view.container.querySelectorAll(".wm .swoosh")).toHaveLength(3));
  return view;
}

describe("LandingPage", () => {
  beforeEach(() => {
    installBrowserStubs();
    window.scrollTo = jest.fn();
  });

  it("shows every section of the approved design", async () => {
    // Arrange
    const headings = [
      "One app to verify every field visit",
      "Everything a field team needs, in one simple app",
      "Don't change how you talk. WorKiya will.",
    ];

    // Act
    const { container } = await renderPage();

    // Assert
    headings.forEach((name) => expect(screen.getByRole("heading", { name })).toBeInTheDocument());
    expect(screen.getByText("Made for teams on the move")).toBeInTheDocument();
    ["#features", "#labels", "#why", "#contact"].forEach((id) => {
      expect(container.querySelector(id)).toBeInTheDocument();
    });
    expect(container.querySelectorAll(".hcard")).toHaveLength(5);
    expect(metadata.title).toBe("WorKiya Field Visits");
  });

  it("sends visitors to the login page and to the demo email", async () => {
    // Arrange
    const demoHref = "mailto:hello@workiya.com";

    // Act
    await renderPage();

    // Assert
    screen.getAllByRole("link", { name: "Log in" }).forEach((a) => {
      expect(a).toHaveAttribute("href", "/login");
    });
    const demoLinks = screen.getAllByRole("link", { name: /book a demo/i });
    expect(demoLinks.map((a) => a.getAttribute("href"))).toContain(demoHref);
  });
});
