"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";

const ThemeContext = createContext({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  /* Load saved preference */
  useEffect(() => {
    const saved = localStorage.getItem("wk-theme") || "light";
    // localStorage exists only in the browser; reading it during render would make the
    // server and client HTML differ (hydration mismatch), so it is read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("wk-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
