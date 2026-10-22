import { configureStore } from "@reduxjs/toolkit";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer from "@/store/authSlice";
import settingsReducer from "@/store/settingsSlice";
import { useActivityTypes } from "./useActivityTypes";

jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function renderWithStore(hook) {
  const store = configureStore({ reducer: { auth: authReducer, settings: settingsReducer } });
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return renderHook(hook, { wrapper });
}

const VISIT = { id: 1, code: "VISIT", name: "Visit" };
const DELIVERY = { id: 2, code: "DELIVERY", name: "Delivery" };

describe("useActivityTypes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the activity types once", async () => {
    // Arrange
    api.get.mockResolvedValue({ data: { success: true, data: [VISIT] } });

    // Act
    const { result } = renderWithStore(() => useActivityTypes());

    // Assert
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).toHaveBeenCalledWith("/settings/activity-types");
    expect(result.current.types).toEqual([VISIT]);
  });

  it("reload fetches the types again", async () => {
    // Arrange
    api.get.mockResolvedValueOnce({ data: { success: true, data: [VISIT] } })
      .mockResolvedValueOnce({ data: { success: true, data: [VISIT, DELIVERY] } });
    const { result } = renderWithStore(() => useActivityTypes());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Act
    await act(() => result.current.reload());

    // Assert
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(result.current.types).toEqual([VISIT, DELIVERY]);
  });
});
