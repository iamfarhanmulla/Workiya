import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer, { setUser } from "@/store/authSlice";
import settingsReducer from "@/store/settingsSlice";
import { ThemeProvider } from "./ThemeProvider";
import TopNav from "./TopNav";

const mockPathname = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function renderNav(roleCode, { withTheme = false } = {}) {
  const store = configureStore({ reducer: { auth: authReducer, settings: settingsReducer } });
  store.dispatch(setUser({
    id: 1, firstName: "Asha", lastName: "Rao", roleName: "Admin", roleCode,
  }));
  const nav = withTheme ? <ThemeProvider><TopNav /></ThemeProvider> : <TopNav />;
  render(<Provider store={store}>{nav}</Provider>);
}

const mainNav = () => screen.getByRole("navigation", { name: "Main" });

describe("TopNav", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/dashboard/accounts/12");
    const labels = {
      "account.plural": "Doctors", "activity.plural": "Visits", "activity.singular": "Visit",
    };
    api.get.mockResolvedValue({ data: { success: true, data: labels } });
  });

  it("uses the company labels and marks the current section", async () => {
    // Arrange / Act
    renderNav("ADMIN");

    // Assert
    const doctors = await screen.findByRole("link", { name: "Doctors" });
    expect(doctors).toHaveAttribute("href", "/dashboard/accounts");
    expect(doctors).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Visits" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "New Visit" }))
      .toHaveAttribute("href", "/dashboard/activities");
    expect(api.get).toHaveBeenCalledWith("/settings/terminology");
  });

  it("opens a group menu, and Escape closes it and returns focus", async () => {
    // Arrange
    renderNav("ADMIN");
    const user = userEvent.setup();
    const people = screen.getByRole("button", { name: /People/ });

    // Act
    await user.click(people);
    const openLinks = ["Users", "Managers", "Employees"]
      .map((n) => screen.getByRole("link", { name: n }));
    await user.keyboard("{Escape}");

    // Assert
    expect(openLinks[2]).toHaveAttribute("href", "/dashboard/employees");
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(people).toHaveAttribute("aria-expanded", "false");
    expect(people).toHaveFocus();
  });

  it("closes a group menu on a click outside it", async () => {
    // Arrange
    renderNav("ADMIN");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Attendance/ }));

    // Act
    await user.click(document.body);

    // Assert
    expect(screen.queryByRole("link", { name: "Leaves" })).not.toBeInTheDocument();
  });

  it("gives admins the company settings menu", async () => {
    // Arrange
    renderNav("ADMIN");
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: "Company settings" }));

    // Assert
    expect(screen.getByRole("link", { name: /Settings/ }))
      .toHaveAttribute("href", "/dashboard/settings");
    expect(screen.getByRole("link", { name: /Billing/ }))
      .toHaveAttribute("href", "/dashboard/billing");
  });

  it("hides settings, people and the create shortcut from an EMPLOYEE", async () => {
    // Arrange / Act
    renderNav("EMPLOYEE");
    await screen.findByRole("link", { name: "Doctors" });

    // Assert
    expect(screen.queryByRole("button", { name: "Company settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /People/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /New / })).not.toBeInTheDocument();
  });

  it("switches between light and dark theme", async () => {
    // Arrange
    renderNav("ADMIN", { withTheme: true });
    const user = userEvent.setup();

    // Act
    await user.click(await screen.findByRole("button", { name: "Switch to dark theme" }));

    // Assert
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("highlights the group and the settings button that hold the current page", async () => {
    // Arrange
    mockPathname.mockReturnValue("/dashboard/settings");
    renderNav("ADMIN");
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: "Company settings" }));

    // Assert
    expect(screen.getByRole("button", { name: "Company settings" })).toHaveClass("is-active");
    expect(screen.getByRole("link", { name: /Settings/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /People/ })).not.toHaveClass("is-active");
  });

  it("opens the small-screen menu with every link and closes it after a choice", async () => {
    // Arrange
    renderNav("MANAGER");
    const user = userEvent.setup();
    await waitFor(() => expect(mainNav()).toBeInTheDocument());

    // Act
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const menu = screen.getByRole("navigation", { name: "Main menu" });
    const team = Array.from(menu.querySelectorAll("a"))
      .find((a) => a.textContent === "Team");
    team.addEventListener("click", (e) => e.preventDefault()); // jsdom cannot navigate
    await user.click(team);

    // Assert
    expect(team).toHaveAttribute("href", "/dashboard/employees");
    expect(screen.queryByRole("navigation", { name: "Main menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open menu" }))
      .toHaveAttribute("aria-expanded", "false");
  });
});
