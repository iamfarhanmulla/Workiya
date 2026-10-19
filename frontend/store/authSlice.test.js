import { configureStore } from "@reduxjs/toolkit";
import { api } from "@/lib/apiClient";
import reducer, {
  clearUser,
  fetchCurrentUser,
  logoutUser,
  selectAuthStatus,
  selectUser,
  selectUserId,
  setUser,
} from "./authSlice";

jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const USER = { id: 7, roleCode: "ADMIN", email: "admin@example.com" };

function makeStore() {
  return configureStore({ reducer: { auth: reducer } });
}

describe("authSlice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts idle with no user", () => {
    // Arrange
    const store = makeStore();

    // Act
    const state = store.getState();

    // Assert
    expect(selectUser(state)).toBeNull();
    expect(selectUserId(state)).toBeNull();
    expect(selectAuthStatus(state)).toBe("idle");
  });

  it("setUser and clearUser update user and status", () => {
    // Arrange
    const store = makeStore();

    // Act
    store.dispatch(setUser(USER));
    const afterSet = store.getState();
    store.dispatch(clearUser());
    const afterClear = store.getState();

    // Assert
    expect(selectUserId(afterSet)).toBe(7);
    expect(selectAuthStatus(afterSet)).toBe("authenticated");
    expect(selectUser(afterClear)).toBeNull();
    expect(selectAuthStatus(afterClear)).toBe("unauthenticated");
  });

  it("fetchCurrentUser stores the user from /auth/me", async () => {
    // Arrange
    api.get.mockResolvedValue({ data: { success: true, data: { user: USER } } });
    const store = makeStore();

    // Act
    await store.dispatch(fetchCurrentUser());

    // Assert
    expect(api.get).toHaveBeenCalledWith("/auth/me");
    expect(selectUser(store.getState())).toEqual(USER);
    expect(selectAuthStatus(store.getState())).toBe("authenticated");
  });

  it("fetchCurrentUser marks the session unauthenticated on failure", async () => {
    // Arrange
    api.get.mockRejectedValue(new Error("401"));
    const store = makeStore();

    // Act
    await store.dispatch(fetchCurrentUser());

    // Assert
    expect(selectAuthStatus(store.getState())).toBe("unauthenticated");
  });

  it("does not start a second fetchCurrentUser while one is loading", async () => {
    // Arrange
    api.get.mockResolvedValue({ data: { success: true, data: { user: USER } } });
    const store = makeStore();

    // Act
    await Promise.all([store.dispatch(fetchCurrentUser()), store.dispatch(fetchCurrentUser())]);

    // Assert
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("keeps a login that happens while fetchCurrentUser is in flight", async () => {
    // Arrange
    let rejectMe;
    api.get.mockReturnValue(new Promise((_, reject) => { rejectMe = reject; }));
    const store = makeStore();

    // Act
    const pending = store.dispatch(fetchCurrentUser());
    store.dispatch(setUser(USER));
    rejectMe(new Error("401"));
    await pending;

    // Assert
    expect(selectUser(store.getState())).toEqual(USER);
  });

  it("logoutUser posts to /auth/logout and clears the user", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const store = makeStore();
    store.dispatch(setUser(USER));

    // Act
    await store.dispatch(logoutUser());

    // Assert
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
    expect(selectUser(store.getState())).toBeNull();
  });

  it("logoutUser keeps the user when the call fails, because the session is still valid", async () => {
    // Arrange
    api.post.mockRejectedValue(new Error("network"));
    const store = makeStore();
    store.dispatch(setUser(USER));

    // Act
    await store.dispatch(logoutUser());

    // Assert
    expect(selectUser(store.getState())).toEqual(USER);
    expect(selectAuthStatus(store.getState())).toBe("authenticated");
  });
});
