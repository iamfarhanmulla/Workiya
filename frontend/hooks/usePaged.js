"use client";

import { useState } from "react";

// Every list shows this many rows per page unless a page asks for another size.
export const DEFAULT_PAGE_SIZE = 15;

// Client-side paging of an already loaded list. The page goes back to 1 whenever resetKey
// changes (by default the row count, so a new filter or search starts at the top) and is
// clamped when rows disappear from the last page.
export function usePaged(items, { pageSize = DEFAULT_PAGE_SIZE, resetKey = items.length } = {}) {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const wanted = state.key === resetKey ? state.page : 1;
  const page = Math.min(Math.max(wanted, 1), pages);
  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total: items.length,
    pageItems: items.slice(start, start + pageSize),
    setPage: (next) => setState({ key: resetKey, page: next }),
  };
}
