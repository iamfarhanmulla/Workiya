import { render, screen, waitFor } from "@testing-library/react";
import { api, setSessionExpiredHandler } from "@/lib/apiClient";
import ReduxProvider, { isAppPage } from "./ReduxProvider";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

function goTo(path) {
  window.history.pushState({}, "", path);
}

describe("ReduxProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { success: true, data: { user: { id: 1 } } } });
    api.post.mockResolvedValue({ data: { success: true } });
  });

  afterEach(() => goTo("/"));

  it("removes the legacy user cache and loads the current user on app pages", async () => {
    // Arrange
    localStorage.setItem("wk_user", JSON.stringify({ id: 99 }));
    goTo("/dashboard/companies");

    // Act
    render(<ReduxProvider><p>child</p></ReduxProvider>);

    // Assert
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(localStorage.getItem("wk_user")).toBeNull();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/auth/me"));
  });

  it.each(["/", "/login"])("does not ask who is signed in on the public page %s", (path) => {
    // Arrange
    goTo(path);

    // Act
    render(<ReduxProvider><p>child</p></ReduxProvider>);

    // Assert
    expect(api.get).not.toHaveBeenCalled();
  });

  it("registers a session-expired handler that logs out", async () => {
    // Arrange
    goTo("/");
    render(<ReduxProvider><p>child</p></ReduxProvider>);
    const handler = setSessionExpiredHandler.mock.calls[0][0];

    // Act
    await handler();

    // Assert
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
  });
});

describe("isAppPage", () => {
  it.each([
    ["/dashboard", true],
    ["/dashboard/users", true],
    ["/", false],
    ["/login", false],
    ["/dashboards", false],
  ])("treats %s as an app page: %s", (path, expected) => {
    // Arrange
    const pathname = path;

    // Act
    const result = isAppPage(pathname);

    // Assert
    expect(result).toBe(expected);
  });
});
