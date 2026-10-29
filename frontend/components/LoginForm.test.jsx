import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer, { selectUser } from "@/store/authSlice";
import LoginForm, { MISSING_MESSAGE } from "./LoginForm";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/apiClient", () => ({
  ...jest.requireActual("@/lib/apiClient"),
  api: { post: jest.fn() },
}));

const USER = { id: 3, email: "user@example.com", roleCode: "EMPLOYEE" };

function renderForm() {
  const store = configureStore({ reducer: { auth: authReducer } });
  render(
    <Provider store={store}>
      <LoginForm />
    </Provider>,
  );
  return store;
}

async function fillAndSubmit(user, { remember }) {
  await user.type(screen.getByLabelText("Work email"), "user@example.com");
  await user.type(screen.getByLabelText("Password"), "Secret#123");
  if (remember) await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("submits credentials with rememberMe, stores the user and navigates", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { user: USER } } });
    const store = renderForm();
    const user = userEvent.setup();

    // Act
    await fillAndSubmit(user, { remember: true });

    // Assert
    expect(api.post).toHaveBeenCalledWith("/auth/login", {
      email: "user@example.com",
      password: "Secret#123",
      rememberMe: true,
    });
    expect(selectUser(store.getState())).toEqual(USER);
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("sends rememberMe false when the checkbox is not ticked", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { user: USER } } });
    renderForm();
    const user = userEvent.setup();

    // Act
    await fillAndSubmit(user, { remember: false });

    // Assert
    expect(api.post.mock.calls[0][1].rememberMe).toBe(false);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("shows the server error message and does not navigate", async () => {
    // Arrange
    api.post.mockRejectedValue({
      response: { status: 401, data: { success: false, message: "Invalid email or password." } },
    });
    const store = renderForm();
    const user = userEvent.setup();

    // Act
    await fillAndSubmit(user, { remember: false });

    // Assert
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(selectUser(store.getState())).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows and hides the password", async () => {
    // Arrange
    renderForm();
    const user = userEvent.setup();
    const password = screen.getByLabelText("Password");

    // Act
    await user.click(screen.getByRole("button", { name: "Show password" }));

    // Assert
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeInTheDocument();
  });

  it("blocks an empty form, flags both fields and does not call the API", async () => {
    // Arrange
    renderForm();
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent(MISSING_MESSAGE);
    expect(api.post).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText("Work email")).toHaveAttribute("aria-invalid", "true");
    });
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("flags an email that is not an email address", async () => {
    // Arrange
    renderForm();
    const user = userEvent.setup();

    // Act
    await user.type(screen.getByLabelText("Work email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "Secret#123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Assert
    expect(api.post).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByLabelText("Work email")).toHaveAttribute("aria-invalid", "true");
    });
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid");
  });

  it("trims the email and shows the signed-in state on success", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { user: USER } } });
    renderForm();
    const user = userEvent.setup();

    // Act
    await user.type(screen.getByLabelText("Work email"), "  user@example.com ");
    await user.type(screen.getByLabelText("Password"), "Secret#123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    // Assert
    expect(api.post.mock.calls[0][1].email).toBe("user@example.com");
    expect(await screen.findByRole("button", { name: /signed in/i })).toBeDisabled();
  });

  it("shows a connection message when the server is unreachable", async () => {
    // Arrange
    api.post.mockRejectedValue(new Error("Network Error"));
    renderForm();
    const user = userEvent.setup();

    // Act
    await fillAndSubmit(user, { remember: false });

    // Assert
    expect(await screen.findByText("Cannot connect to server.")).toBeInTheDocument();
  });
});
