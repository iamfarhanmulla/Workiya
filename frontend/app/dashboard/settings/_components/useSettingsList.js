"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";

// Loads a settings list with a stable fetcher (wrap it in useCallback) and re-loads on refresh().
export default function useSettingsList(fetcher, notify, errorMessage) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetcher()
      .then((data) => {
        if (active) setItems(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) notify(getErrorMessage(err, errorMessage), "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetcher, notify, errorMessage, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { items, loading, refresh };
}
