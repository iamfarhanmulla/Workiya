import { render, screen, waitFor } from "@testing-library/react";
import { api, setSessionExpiredHandler } from "@/lib/apiClient";
import ReduxProvider from "./ReduxProvider";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  setSessionExpiredHandler: jest.fn(),
}));

describe("ReduxProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { success: true, data: { user: { id: 1 } } } });
    api.post.mockResolvedValue({ data: { success: true } });
  });

  it("removes the legacy user cache and loads the current user on mount", async () => {
    // Arrange
    localStorage.setItem("wk_user", JSON.stringify({ id: 99 }));

    // Act
    render(<ReduxProvider><p>child</p></ReduxProvider>);

    // Assert
    expect(screen.getByText("child")).toBeInTheDocument();
    expect(localStorage.getItem("wk_user")).toBeNull();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/auth/me"));
  });

  it("registers a session-expired handler that logs out", async () => {
    // Arrange
    render(<ReduxProvider><p>child</p></ReduxProvider>);
    const handler = setSessionExpiredHandler.mock.calls[0][0];

    // Act
    await handler();

    // Assert
    expect(api.post).toHaveBeenCalledWith("/auth/logout");
  });
});
