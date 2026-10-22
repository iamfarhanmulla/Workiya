import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { gsap } from "gsap";
import { api } from "@/lib/apiClient";
import authReducer from "@/store/authSlice";
import settingsReducer from "@/store/settingsSlice";
import Sidebar, { buildSections } from "./Sidebar";

const mockPathname = jest.fn();

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname() }));
jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock("gsap", () => ({ gsap: { to: jest.fn(), fromTo: jest.fn(), set: jest.fn() } }));

function renderSidebar() {
  const store = configureStore({ reducer: { auth: authReducer, settings: settingsReducer } });
  return render(
    <Provider store={store}>
      <Sidebar />
    </Provider>,
  );
}

describe("buildSections", () => {
  it("labels the accounts and activities entries with the terminology", () => {
    // Arrange
    const t = (key) => `T:${key}`;

    // Act
    const fieldOps = buildSections(t).find((s) => s.label === "Field Ops");

    // Assert
    expect(fieldOps.items.map((i) => [i.label, i.href])).toEqual([
      ["Employees", "/dashboard/employees"],
      ["T:account.plural", "/dashboard/accounts"],
      ["T:activity.plural", "/dashboard/activities"],
    ]);
  });
});

describe("Sidebar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue("/dashboard/accounts/12");
  });

  it("shows the company labels for accounts and activities and marks the active link", async () => {
    // Arrange
    api.get.mockResolvedValue({
      data: { success: true, data: { "account.plural": "Doctors", "activity.plural": "Tasks" } },
    });

    // Act
    renderSidebar();

    // Assert
    const accounts = screen.getByRole("link", { name: /Accounts$/ });
    expect(accounts).toHaveAttribute("href", "/dashboard/accounts");
    await waitFor(() => expect(screen.getByRole("link", { name: /Doctors$/ })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /Doctors$/ })).toHaveClass("active");
    const tasks = screen.getByRole("link", { name: /Tasks$/ });
    expect(tasks).toHaveAttribute("href", "/dashboard/activities");
    expect(screen.getByRole("link", { name: /dashboard/i })).not.toHaveClass("active");
    expect(api.get).toHaveBeenCalledWith("/settings/terminology");
    expect(gsap.fromTo).toHaveBeenCalled();
  });

  it("collapses and expands, showing tooltips only while collapsed", async () => {
    // Arrange
    api.get.mockRejectedValue(new Error("400"));
    mockPathname.mockReturnValue("/dashboard/settings");
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });

    // Act
    await user.click(toggle);
    const collapsedTips = container.querySelectorAll(".sb-tooltip").length;
    await user.click(toggle);
    const expandedTips = container.querySelectorAll(".sb-tooltip").length;

    // Assert
    expect(collapsedTips).toBeGreaterThan(0);
    expect(expandedTips).toBe(0);
    expect(screen.getByRole("link", { name: /settings/i })).toHaveClass("active");
    expect(gsap.set).toHaveBeenCalledWith(expect.anything(), { display: "block" });
  });

  it("animates the icon on hover and click", async () => {
    // Arrange
    api.get.mockRejectedValue(new Error("400"));
    const user = userEvent.setup();
    renderSidebar();
    gsap.to.mockClear();
    gsap.fromTo.mockClear();

    // Act
    const link = screen.getByRole("link", { name: /billing/i });
    link.addEventListener("click", (e) => e.preventDefault());
    await user.hover(link);
    await user.unhover(link);
    await user.click(link);

    // Assert
    const scaled = (scale) => expect.objectContaining({ scale });
    expect(gsap.to).toHaveBeenCalledWith(expect.anything(), scaled(1.12));
    expect(gsap.to).toHaveBeenCalledWith(expect.anything(), scaled(1));
    expect(gsap.fromTo).toHaveBeenCalledWith(
      expect.anything(),
      { scale: 0.72, rotate: -10 },
      expect.objectContaining({ scale: 1 }),
    );
  });
});
