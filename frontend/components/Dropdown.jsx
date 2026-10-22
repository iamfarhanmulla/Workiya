"use client";

import { useId } from "react";
import useDropdown from "@/hooks/useDropdown";

// A button that shows or hides a panel below it (disclosure pattern: Tab moves
// through the panel's links; Escape or a click outside closes it).
// children is a function that receives close(), so a chosen link can close the panel.
export default function Dropdown({
  as: Tag = "div", align = "start", triggerClassName, triggerLabel, triggerContent, children,
}) {
  const {
    open, toggle, close, rootRef, triggerRef,
  } = useDropdown();
  const panelId = useId();
  const panelClass = `wk-menu wk-dropdown-panel${align === "end" ? " wk-dropdown-panel--end" : ""}`;

  return (
    <Tag className="wk-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
      >
        {triggerContent}
      </button>
      {open && <div id={panelId} className={panelClass}>{children(close)}</div>}
    </Tag>
  );
}
