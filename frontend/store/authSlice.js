import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api } from "@/lib/apiClient";

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async () => {
    const res = await api.get("/auth/me");
    return res.data.data.user;
  },
  { condition: (_, { getState }) => getState().auth.status !== "loading" },
);

export const logoutUser = createAsyncThunk("auth/logoutUser", async () => {
  await api.post("/auth/logout");
});

function applyUser(state, user) {
  state.user = user;
  state.status = "authenticated";
}

function resetUser(state) {
  state.user = null;
  state.status = "unauthenticated";
}

const authSlice = createSlice({
  name: "auth",
  initialState: { user: null, status: "idle" },
  reducers: {
    setUser(state, action) {
      applyUser(state, action.payload);
    },
    clearUser(state) {
      resetUser(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        applyUser(state, action.payload);
      })
      .addCase(fetchCurrentUser.rejected, (state) => {
        // A login (setUser) or clearUser that landed while /auth/me was in flight wins.
        if (state.status === "loading") resetUser(state);
      })
      // A failed logout leaves the session cookies in place, so the user stays signed in.
      .addCase(logoutUser.fulfilled, resetUser);
  },
});

export const { setUser, clearUser } = authSlice.actions;
export const selectUser = (state) => state.auth.user;
export const selectUserId = (state) => state.auth.user?.id ?? null;
export const selectAuthStatus = (state) => state.auth.status;
export default authSlice.reducer;
