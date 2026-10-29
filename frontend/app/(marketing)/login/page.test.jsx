import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import authReducer from "@/store/authSlice";
import { installBrowserStubs } from "@/test-utils/browserStubs";
import LoginPage, { metadata } from "./page";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));

function renderPage() {
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(<Provider store={store}><LoginPage /></Provider>);
}

describe("LoginPage", () => {
  beforeEach(() => installBrowserStubs());

  it("shows the sign-in form with a way back to the landing page", () => {
    // Arrange
    const title = "WorKiya Sign in";

    // Act
    renderPage();

    // Assert
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back");
    expect(screen.getByLabelText("Work email")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WorKiya home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "book a demo" })).toHaveAttribute("href", "/#contact");
    expect(metadata.title).toBe(title);
  });

  it("keeps the decorative story panel away from screen readers", () => {
    // Arrange
    const panelHeading = "Every visit, verified.";

    // Act
    const { container } = renderPage();

    // Assert
    expect(screen.queryByRole("heading", { name: panelHeading })).toBeNull();
    expect(container.querySelector("aside")).toHaveAttribute("aria-hidden", "true");
  });
});
