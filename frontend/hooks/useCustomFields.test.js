import { configureStore } from "@reduxjs/toolkit";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer from "@/store/authSlice";
import settingsReducer from "@/store/settingsSlice";
import { activeSortedFields, useCustomFields } from "./useCustomFields";

jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function renderWithStore(hook) {
  const store = configureStore({ reducer: { auth: authReducer, settings: settingsReducer } });
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return renderHook(hook, { wrapper });
}

const FIELDS = [
  {
    id: 1, fieldKey: "zeta", label: "Zeta", sortOrder: 1, isActive: true,
  },
  {
    id: 2, fieldKey: "alpha", label: "Alpha", sortOrder: 1, isActive: true,
  },
  {
    id: 3, fieldKey: "first", label: "First", sortOrder: 0, isActive: true,
  },
  {
    id: 4, fieldKey: "old", label: "Old", sortOrder: 0, isActive: false,
  },
];

describe("activeSortedFields", () => {
  it("drops inactive fields and sorts by sortOrder then label", () => {
    // Arrange
    const fields = [...FIELDS, { id: 5, fieldKey: "bare" }];

    // Act
    const keys = activeSortedFields(fields).map((f) => f.fieldKey);

    // Assert
    expect(keys).toEqual(["bare", "first", "alpha", "zeta"]);
  });

  it("returns an empty list for missing input", () => {
    // Arrange
    const input = undefined;

    // Act
    const result = activeSortedFields(input);

    // Assert
    expect(result).toEqual([]);
  });
});

describe("useCustomFields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the active fields for the entity type in order", async () => {
    // Arrange
    api.get.mockResolvedValue({ data: { success: true, data: FIELDS } });

    // Act
    const { result } = renderWithStore(() => useCustomFields("ACCOUNT"));

    // Assert
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).toHaveBeenCalledWith(
      "/settings/custom-fields",
      { params: { entityType: "ACCOUNT" } },
    );
    expect(result.current.fields.map((f) => f.fieldKey)).toEqual(["first", "alpha", "zeta"]);
  });

  it("reload fetches the fields again", async () => {
    // Arrange
    api.get.mockResolvedValueOnce({ data: { success: true, data: [] } })
      .mockResolvedValueOnce({ data: { success: true, data: [FIELDS[0]] } });
    const { result } = renderWithStore(() => useCustomFields("SUBMISSION"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Act
    await act(() => result.current.reload());

    // Assert
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(result.current.fields).toHaveLength(1);
  });
});
