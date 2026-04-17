import { createSlice } from "@reduxjs/toolkit";

function loadFromStorage() {
  try {
    const stored = localStorage.getItem("wk_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      try { localStorage.setItem("wk_user", JSON.stringify(action.payload)); } catch {}
    },
    clearUser(state) {
      state.user = null;
      try { localStorage.removeItem("wk_user"); } catch {}
    },
    hydrateUser(state) {
      state.user = loadFromStorage();
    },
  },
});

export const { setUser, clearUser, hydrateUser } = authSlice.actions;
export const selectUser   = (state) => state.auth.user;
export const selectUserId = (state) => state.auth.user?.id ?? null;
export default authSlice.reducer;
