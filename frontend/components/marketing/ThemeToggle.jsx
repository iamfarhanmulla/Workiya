"use client";

import { Moon } from "./icons";
import { toggleTheme } from "./motion";

export default function ThemeToggle() {
  return (
    <button
      className="icon-btn"
      type="button"
      aria-label="Switch light or dark mode"
      onClick={() => toggleTheme()}
    >
      <Moon />
    </button>
  );
}
