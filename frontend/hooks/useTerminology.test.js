import { configureStore } from "@reduxjs/toolkit";
import { act, renderHook, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer, { clearUser } from "@/store/authSlice";
import settingsReducer from "@/store/settingsSlice";
import { translate, useTerminology } from "./useTerminology";

jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function renderWithStore(hook, store) {
  const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
  return renderHook(hook, { wrapper });
}

function makeStore() {
  return configureStore({ reducer: { auth: authReducer, settings: settingsReducer } });
}

function wrap(data) {
  return { data: { success: true, data } };
}

describe("translate", () => {
  it("uses the company label, then the default, then the key itself", () => {
    // Arrange
    const labels = { "account.plural": "Doctors", "activity.plural": "" };

    // Act
    const results = [
      translate(labels, "account.plural"),
      translate(labels, "activity.plural"),
      translate(null, "submission.singular"),
      translate(labels, "unknown.key"),
    ];

    // Assert
    expect(results).toEqual(["Doctors", "Activities", "Submission", "unknown.key"]);
  });
});

describe("useTerminology", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches the labels once and translates with them", async () => {
    // Arrange
    api.get.mockResolvedValue(wrap({ "account.plural": "Doctors" }));
    const store = makeStore();

    // Act
    const { result } = renderWithStore(() => useTerminology(), store);
    const second = renderWithStore(() => useTerminology(), store);

    // Assert
    expect(result.current.loading).toBe(true);
    expect(result.current.t("account.plural")).toBe("Accounts");
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.t("account.plural")).toBe("Doctors");
    expect(second.result.current.t("account.plural")).toBe("Doctors");
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it("reload fetches the labels again", async () => {
    // Arrange
    api.get.mockResolvedValueOnce(wrap({ "account.plural": "Doctors" }))
      .mockResolvedValueOnce(wrap({ "account.plural": "Stores" }));
    const store = makeStore();
    const { result } = renderWithStore(() => useTerminology(), store);
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Act
    await act(() => result.current.reload());

    // Assert
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(result.current.t("account.plural")).toBe("Stores");
  });

  it("falls back to the defaults when the request fails", async () => {
    // Arrange
    api.get.mockRejectedValue(new Error("400"));
    const store = makeStore();

    // Act
    const { result } = renderWithStore(() => useTerminology(), store);

    // Assert
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.t("activity.plural")).toBe("Activities");
  });

  it("does not fetch once the user is signed out", () => {
    // Arrange
    const store = makeStore();
    store.dispatch(clearUser());

    // Act
    const { result } = renderWithStore(() => useTerminology(), store);

    // Assert
    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.t("account.singular")).toBe("Account");
  });
});
