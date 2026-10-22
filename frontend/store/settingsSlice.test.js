import { configureStore } from "@reduxjs/toolkit";
import { api } from "@/lib/apiClient";
import authReducer, { clearUser, logoutUser, setUser } from "./authSlice";
import reducer, {
  DEFAULT_TERMINOLOGY,
  fetchActivityTypes,
  fetchCustomFields,
  fetchTerminology,
  resetSettings,
  selectActivityTypes,
  selectActivityTypesStatus,
  selectCustomFields,
  selectCustomFieldsStatus,
  selectTerminology,
  selectTerminologyStatus,
} from "./settingsSlice";

jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

function makeStore() {
  return configureStore({ reducer: { auth: authReducer, settings: reducer } });
}

function wrap(data) {
  return { data: { success: true, data } };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const FIELD = {
  id: 1, entityType: "ACCOUNT", fieldKey: "speciality", label: "Speciality", isActive: true,
};

describe("settingsSlice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts idle with the default terminology and empty lists", () => {
    // Arrange
    const store = makeStore();

    // Act
    const state = store.getState();

    // Assert
    expect(selectTerminology(state)).toEqual(DEFAULT_TERMINOLOGY);
    expect(selectTerminologyStatus(state)).toBe("idle");
    expect(selectCustomFields("ACCOUNT")(state)).toEqual([]);
    expect(selectCustomFieldsStatus("ACCOUNT")(state)).toBe("idle");
    expect(selectActivityTypes(state)).toEqual([]);
    expect(selectActivityTypesStatus(state)).toBe("idle");
  });

  it("selectors return stable defaults when the store has no settings reducer", () => {
    // Arrange
    const state = { auth: {} };

    // Act
    const first = selectTerminology(state);
    const second = selectTerminology(state);

    // Assert
    expect(first).toEqual(DEFAULT_TERMINOLOGY);
    expect(first).toBe(second);
    expect(selectCustomFields("SUBMISSION")(state)).toBe(selectCustomFields("SUBMISSION")(state));
  });

  it("caches selector instances per entity type", () => {
    // Arrange
    const entityType = "ACCOUNT";

    // Act
    const a = selectCustomFields(entityType);
    const b = selectCustomFields(entityType);

    // Assert
    expect(a).toBe(b);
    expect(selectCustomFieldsStatus(entityType)).toBe(selectCustomFieldsStatus(entityType));
  });

  it("fetchTerminology merges the labels over the defaults", async () => {
    // Arrange
    api.get.mockResolvedValue(wrap({ "account.plural": "Doctors" }));
    const store = makeStore();

    // Act
    await store.dispatch(fetchTerminology());

    // Assert
    expect(api.get).toHaveBeenCalledWith("/settings/terminology");
    const labels = selectTerminology(store.getState());
    expect(labels["account.plural"]).toBe("Doctors");
    expect(labels["activity.singular"]).toBe("Activity");
    expect(selectTerminologyStatus(store.getState())).toBe("succeeded");
  });

  it("fetchTerminology keeps the defaults when the payload is empty", async () => {
    // Arrange
    api.get.mockResolvedValue(wrap(null));
    const store = makeStore();

    // Act
    await store.dispatch(fetchTerminology());

    // Assert
    expect(selectTerminology(store.getState())).toEqual(DEFAULT_TERMINOLOGY);
  });

  it("fetchCustomFields stores fields per entity type and sends the entityType param", async () => {
    // Arrange
    api.get.mockResolvedValue(wrap([FIELD]));
    const store = makeStore();

    // Act
    await store.dispatch(fetchCustomFields("ACCOUNT"));

    // Assert
    expect(api.get).toHaveBeenCalledWith(
      "/settings/custom-fields",
      { params: { entityType: "ACCOUNT" } },
    );
    expect(selectCustomFields("ACCOUNT")(store.getState())).toEqual([FIELD]);
    expect(selectCustomFieldsStatus("ACCOUNT")(store.getState())).toBe("succeeded");
    expect(selectCustomFields("SUBMISSION")(store.getState())).toEqual([]);
  });

  it("fetchCustomFields stores an empty list when the payload is not an array", async () => {
    // Arrange
    api.get.mockResolvedValue(wrap({}));
    const store = makeStore();

    // Act
    await store.dispatch(fetchCustomFields("SUBMISSION"));

    // Assert
    expect(selectCustomFields("SUBMISSION")(store.getState())).toEqual([]);
  });

  it("fetchActivityTypes stores the types", async () => {
    // Arrange
    const types = [{ id: 3, code: "VISIT", name: "Visit" }];
    api.get.mockResolvedValue(wrap(types));
    const store = makeStore();

    // Act
    await store.dispatch(fetchActivityTypes());

    // Assert
    expect(api.get).toHaveBeenCalledWith("/settings/activity-types");
    expect(selectActivityTypes(store.getState())).toEqual(types);
  });

  it("marks each entry failed when its request fails", async () => {
    // Arrange
    api.get.mockRejectedValue(new Error("boom"));
    const store = makeStore();

    // Act
    await store.dispatch(fetchTerminology());
    await store.dispatch(fetchCustomFields("ACCOUNT"));
    await store.dispatch(fetchActivityTypes());

    // Assert
    const state = store.getState();
    expect(selectTerminologyStatus(state)).toBe("failed");
    expect(selectCustomFieldsStatus("ACCOUNT")(state)).toBe("failed");
    expect(selectActivityTypesStatus(state)).toBe("failed");
    expect(state.settings.terminology.error).toBe("boom");
    expect(selectTerminology(state)).toEqual(DEFAULT_TERMINOLOGY);
  });

  it("skips a duplicate request while one is in flight unless forced", async () => {
    // Arrange
    const pending = deferred();
    api.get.mockReturnValue(pending.promise);
    const store = makeStore();

    // Act
    const calls = [
      store.dispatch(fetchTerminology()),
      store.dispatch(fetchTerminology()),
      store.dispatch(fetchCustomFields("ACCOUNT")),
      store.dispatch(fetchCustomFields("ACCOUNT")),
      store.dispatch(fetchActivityTypes()),
      store.dispatch(fetchActivityTypes()),
    ];
    const callsBeforeForce = api.get.mock.calls.length;
    calls.push(store.dispatch(fetchTerminology({ force: true })));
    pending.resolve(wrap([]));
    await Promise.all(calls);

    // Assert
    expect(callsBeforeForce).toBe(3);
    expect(api.get).toHaveBeenCalledTimes(4);
  });

  it("lets only the latest request write its result", async () => {
    // Arrange
    const slow = deferred();
    api.get.mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce(wrap({ "account.plural": "Stores" }));
    const store = makeStore();

    // Act
    const first = store.dispatch(fetchTerminology());
    await store.dispatch(fetchTerminology({ force: true }));
    slow.resolve(wrap({ "account.plural": "Doctors" }));
    await first;

    // Assert
    expect(selectTerminology(store.getState())["account.plural"]).toBe("Stores");
  });

  it("drops replies that arrive after the settings were reset", async () => {
    // Arrange
    const slow = deferred();
    const slowFail = deferred();
    api.get.mockReturnValueOnce(slow.promise).mockReturnValueOnce(slowFail.promise);
    const store = makeStore();

    // Act
    const pendingFields = store.dispatch(fetchCustomFields("ACCOUNT"));
    const pendingTypes = store.dispatch(fetchActivityTypes());
    store.dispatch(resetSettings());
    slow.resolve(wrap([FIELD]));
    slowFail.reject(new Error("late"));
    await pendingFields;
    await pendingTypes;

    // Assert
    expect(selectCustomFields("ACCOUNT")(store.getState())).toEqual([]);
    expect(selectCustomFieldsStatus("ACCOUNT")(store.getState())).toBe("idle");
    expect(selectActivityTypesStatus(store.getState())).toBe("idle");
  });

  it.each([
    ["setUser", (store) => store.dispatch(setUser({ id: 2 }))],
    ["clearUser", (store) => store.dispatch(clearUser())],
    ["logoutUser", (store) => store.dispatch(logoutUser())],
  ])("resets the settings on %s", async (_name, act) => {
    // Arrange
    api.get.mockResolvedValue(wrap({ "account.plural": "Doctors" }));
    api.post.mockResolvedValue({ data: { success: true } });
    const store = makeStore();
    await store.dispatch(fetchTerminology());

    // Act
    await act(store);

    // Assert
    expect(selectTerminology(store.getState())).toEqual(DEFAULT_TERMINOLOGY);
    expect(selectTerminologyStatus(store.getState())).toBe("idle");
  });
});
