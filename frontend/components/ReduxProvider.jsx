"use client";

import { useEffect } from "react";
import { Provider, useDispatch } from "react-redux";
import { store } from "@/store/store";
import { hydrateUser } from "@/store/authSlice";

function Hydrator({ children }) {
  const dispatch = useDispatch();
  useEffect(() => { dispatch(hydrateUser()); }, [dispatch]);
  return children;
}

export default function ReduxProvider({ children }) {
  return (
    <Provider store={store}>
      <Hydrator>{children}</Hydrator>
    </Provider>
  );
}
