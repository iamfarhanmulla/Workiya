"use client";

import { useEffect } from "react";
import { Provider, useDispatch } from "react-redux";
import { store } from "@/store/store";
import { clearUser, fetchCurrentUser, logoutUser } from "@/store/authSlice";
import { setSessionExpiredHandler } from "@/lib/apiClient";

const LEGACY_USER_KEY = "wk_user";

function removeLegacyUserCache() {
  try {
    localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // Storage can be blocked (private mode); there is nothing to clean up then.
  }
}

function SessionBootstrap({ children }) {
  const dispatch = useDispatch();

  useEffect(() => {
    removeLegacyUserCache();
    setSessionExpiredHandler(async () => {
      dispatch(clearUser());
      // Logout clears the wk_session cookie so the proxy stops sending us back to /dashboard.
      await dispatch(logoutUser());
      if (window.location.pathname !== "/") window.location.assign("/");
    });
    dispatch(fetchCurrentUser());
    return () => setSessionExpiredHandler(null);
  }, [dispatch]);

  return children;
}

export default function ReduxProvider({ children }) {
  return (
    <Provider store={store}>
      <SessionBootstrap>{children}</SessionBootstrap>
    </Provider>
  );
}
