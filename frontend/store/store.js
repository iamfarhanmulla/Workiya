import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

// eslint-disable-next-line import-x/prefer-default-export -- imported as { store }
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});
