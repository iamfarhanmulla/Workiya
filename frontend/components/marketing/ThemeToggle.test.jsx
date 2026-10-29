import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { installBrowserStubs } from "@/test-utils/browserStubs";
import ThemeToggle from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("switches the page between light and dark", async () => {
    // Arrange
    installBrowserStubs();
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle />);
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: "Switch light or dark mode" }));

    // Assert
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
