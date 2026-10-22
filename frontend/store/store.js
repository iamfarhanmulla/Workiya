import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import settingsReducer from "./settingsSlice";

// eslint-disable-next-line import-x/prefer-default-export -- imported as { store }
export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
  },
});
