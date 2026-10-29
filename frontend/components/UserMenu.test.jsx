import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer, { selectUser, setUser } from "@/store/authSlice";
import UserMenu from "./UserMenu";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function renderMenu() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(setUser({
    id: 1,
    firstName: "Asha",
    lastName: "Rao",
    roleName: "Admin",
    roleCode: "ADMIN",
    email: "asha@example.com",
  }));
  render(
    <Provider store={store}>
      <UserMenu />
    </Provider>,
  );
  return store;
}

async function signOut(user) {
  await user.click(screen.getByRole("button", { name: "Account menu: Asha Rao, Admin" }));
  await user.click(screen.getByRole("button", { name: "Sign out" }));
}

describe("UserMenu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows who is signed in", async () => {
    // Arrange
    renderMenu();
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: /Account menu/ }));

    // Assert
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(screen.getByText("Admin · asha@example.com")).toBeInTheDocument();
  });

  it("signs out through the API, clears the user and goes to the login page", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const store = renderMenu();
    const user = userEvent.setup();

    // Act
    await signOut(user);

    // Assert
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
    expect(selectUser(store.getState())).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("stays on the page with the user and shows an error when sign-out fails", async () => {
    // Arrange
    api.post.mockRejectedValue(new Error("network"));
    const store = renderMenu();
    const user = userEvent.setup();

    // Act
    await signOut(user);

    // Assert
    expect(mockPush).not.toHaveBeenCalled();
    expect(selectUser(store.getState())).toMatchObject({ id: 1 });
    expect(screen.getByRole("alert")).toHaveTextContent(/could not sign out/i);
  });
});
