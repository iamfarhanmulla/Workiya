import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "@/lib/apiClient";
import { clearUser, logoutUser, setUser } from "./authSlice";

export const DEFAULT_TERMINOLOGY = Object.freeze({
  "account.singular": "Account",
  "account.plural": "Accounts",
  "activity.singular": "Activity",
  "activity.plural": "Activities",
  "submission.singular": "Submission",
  "submission.plural": "Submissions",
  "rep.singular": "Rep",
  "rep.plural": "Reps",
});

const EMPTY_LIST = Object.freeze([]);
const IDLE_ENTRY = Object.freeze({
  items: EMPTY_LIST, status: "idle", error: null, requestId: null,
});

function idleEntry() {
  return { ...IDLE_ENTRY };
}

function initialState() {
  return {
    terminology: { ...idleEntry(), labels: { ...DEFAULT_TERMINOLOGY } },
    customFields: {},
    activityTypes: idleEntry(),
    activityTypesByCompany: {},
  };
}

// Used when a store has no "settings" reducer, so selectors still return stable values.
const FALLBACK_STATE = Object.freeze(initialState());
const settingsOf = (state) => state.settings ?? FALLBACK_STATE;

// The signed-in user's own company is cached under the bare entity type; a SUPER_ADMIN
// reading a chosen company's settings gets a separate entry per company.
const customFieldKey = (entityType, companyId) => (
  companyId ? `${entityType}@${companyId}` : entityType
);
const customFieldEntry = (state, entityType, companyId) => (
  settingsOf(state).customFields[customFieldKey(entityType, companyId)] ?? IDLE_ENTRY
);
const activityTypesEntry = (state, companyId) => {
  const settings = settingsOf(state);
  if (!companyId) return settings.activityTypes;
  return settings.activityTypesByCompany?.[companyId] ?? IDLE_ENTRY;
};

// Only a SUPER_ADMIN names a company; everyone else reads their own.
function getWithCompany(url, params, companyId) {
  const query = companyId ? { ...params, companyId } : params;
  return query ? api.get(url, { params: query }) : api.get(url);
}

// A forced call (reload after saving settings) always runs; otherwise a request
// already in flight is reused instead of firing a duplicate.
const notLoading = (entry, options) => Boolean(options?.force) || entry.status !== "loading";

export const fetchTerminology = createAsyncThunk(
  "settings/fetchTerminology",
  async () => {
    const res = await api.get("/settings/terminology");
    return res.data.data;
  },
  { condition: (options, { getState }) => notLoading(settingsOf(getState()).terminology, options) },
);

const fetchCustomFieldsThunk = createAsyncThunk(
  "settings/fetchCustomFields",
  async ({ entityType, companyId }) => {
    const res = await getWithCompany("/settings/custom-fields", { entityType }, companyId);
    return res.data.data;
  },
  {
    condition: ({ entityType, companyId, force }, { getState }) => (
      notLoading(customFieldEntry(getState(), entityType, companyId), { force })
    ),
  },
);

// options: { force, companyId } (companyId only for a SUPER_ADMIN).
export function fetchCustomFields(entityType, options) {
  return fetchCustomFieldsThunk({
    entityType, companyId: options?.companyId ?? null, force: Boolean(options?.force),
  });
}

// options: { force, companyId } (companyId only for a SUPER_ADMIN).
export const fetchActivityTypes = createAsyncThunk(
  "settings/fetchActivityTypes",
  async (options) => {
    const res = await getWithCompany("/settings/activity-types", undefined, options?.companyId);
    return res.data.data;
  },
  {
    condition: (options, { getState }) => (
      notLoading(activityTypesEntry(getState(), options?.companyId), options)
    ),
  },
);

// Redux Toolkit reducers write to an Immer draft, not to the real state.
/* eslint-disable no-param-reassign -- Immer draft */
function markPending(entry, action) {
  entry.status = "loading";
  entry.error = null;
  entry.requestId = action.meta.requestId;
}

// Only the latest request may write, so a reply that lands after a newer
// request (or after a logout reset) is dropped.
function isLatest(entry, action) {
  return Boolean(entry) && entry.requestId === action.meta.requestId;
}

function markFulfilled(entry, action, apply) {
  if (!isLatest(entry, action)) return;
  apply(entry, action.payload);
  entry.status = "succeeded";
  entry.requestId = null;
}

function markRejected(entry, action) {
  if (!isLatest(entry, action)) return;
  entry.status = "failed";
  entry.error = action.error?.message ?? "Request failed";
  entry.requestId = null;
}

const applyLabels = (entry, payload) => {
  entry.labels = { ...DEFAULT_TERMINOLOGY, ...(payload ?? {}) };
};
const applyItems = (entry, payload) => {
  entry.items = Array.isArray(payload) ? payload : [];
};

function customFieldsDraft(state, action) {
  const key = customFieldKey(action.meta.arg.entityType, action.meta.arg.companyId);
  if (!state.customFields[key]) state.customFields[key] = idleEntry();
  return state.customFields[key];
}

function activityTypesDraft(state, action) {
  const companyId = action.meta.arg?.companyId;
  if (!companyId) return state.activityTypes;
  if (!state.activityTypesByCompany[companyId]) {
    state.activityTypesByCompany[companyId] = idleEntry();
  }
  return state.activityTypesByCompany[companyId];
}
/* eslint-enable no-param-reassign */

const resetState = () => initialState();

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: { resetSettings: resetState },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTerminology.pending, (s, a) => markPending(s.terminology, a))
      .addCase(fetchTerminology.fulfilled, (s, a) => markFulfilled(s.terminology, a, applyLabels))
      .addCase(fetchTerminology.rejected, (s, a) => markRejected(s.terminology, a))
      .addCase(fetchCustomFieldsThunk.pending, (s, a) => markPending(customFieldsDraft(s, a), a))
      .addCase(fetchCustomFieldsThunk.fulfilled, (s, a) => (
        markFulfilled(customFieldsDraft(s, a), a, applyItems)
      ))
      .addCase(fetchCustomFieldsThunk.rejected, (s, a) => (
        markRejected(customFieldsDraft(s, a), a)
      ))
      .addCase(fetchActivityTypes.pending, (s, a) => markPending(activityTypesDraft(s, a), a))
      .addCase(fetchActivityTypes.fulfilled, (s, a) => (
        markFulfilled(activityTypesDraft(s, a), a, applyItems)
      ))
      .addCase(fetchActivityTypes.rejected, (s, a) => markRejected(activityTypesDraft(s, a), a))
      // Settings belong to the signed-in user's company: drop them when the user changes.
      .addCase(setUser, resetState)
      .addCase(clearUser, resetState)
      .addCase(logoutUser.fulfilled, resetState);
  },
});

export const { resetSettings } = settingsSlice.actions;

export const selectTerminology = (state) => settingsOf(state).terminology.labels;
export const selectTerminologyStatus = (state) => settingsOf(state).terminology.status;

// Selector instances are cached per key so useSelector gets a stable function.
const selectorCache = new Map();

function cachedSelector(key, build) {
  if (!selectorCache.has(key)) selectorCache.set(key, build());
  return selectorCache.get(key);
}

export const selectCustomFields = (entityType, companyId) => cachedSelector(
  `fields:${customFieldKey(entityType, companyId)}`,
  () => (state) => customFieldEntry(state, entityType, companyId).items,
);
export const selectCustomFieldsStatus = (entityType, companyId) => cachedSelector(
  `fieldsStatus:${customFieldKey(entityType, companyId)}`,
  () => (state) => customFieldEntry(state, entityType, companyId).status,
);

export const selectActivityTypes = (state) => activityTypesEntry(state, null).items;
export const selectActivityTypesStatus = (state) => activityTypesEntry(state, null).status;
export const selectCompanyActivityTypes = (companyId) => cachedSelector(
  `types:${companyId ?? ""}`,
  () => (state) => activityTypesEntry(state, companyId).items,
);
export const selectCompanyActivityTypesStatus = (companyId) => cachedSelector(
  `typesStatus:${companyId ?? ""}`,
  () => (state) => activityTypesEntry(state, companyId).status,
);

export default settingsSlice.reducer;
