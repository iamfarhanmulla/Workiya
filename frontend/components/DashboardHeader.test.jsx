import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer, { selectUser, setUser } from "@/store/authSlice";
import DashboardHeader from "./DashboardHeader";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function renderHeader() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(setUser({
    id: 1, firstName: "Asha", lastName: "Rao", roleName: "Admin",
  }));
  render(
    <Provider store={store}>
      <DashboardHeader />
    </Provider>,
  );
  return store;
}

async function clickLogout(user) {
  await user.click(screen.getByRole("button", { name: /asha rao/i }));
  await user.click(screen.getByRole("button", { name: /logout/i }));
}

describe("DashboardHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs out through the API, clears the user and goes to the login page", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const store = renderHeader();
    const user = userEvent.setup();

    // Act
    await clickLogout(user);

    // Assert
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
    expect(selectUser(store.getState())).toBeNull();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("stays on the page with the user and shows an error when the logout call fails", async () => {
    // Arrange
    api.post.mockRejectedValue(new Error("network"));
    const store = renderHeader();
    const user = userEvent.setup();

    // Act
    await clickLogout(user);

    // Assert
    expect(mockPush).not.toHaveBeenCalled();
    expect(selectUser(store.getState())).toMatchObject({ id: 1 });
    expect(screen.getByRole("alert")).toHaveTextContent(/could not sign out/i);
  });
});
