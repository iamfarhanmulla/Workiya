"use client";

import { useState } from "react";
import { getErrorMessage } from "@/lib/apiClient";

// Add/edit/delete state shared by the settings tables. afterChange re-loads the table
// and the app-wide store; remove(row) performs the soft delete.
export default function useRowEditing({
  remove, afterChange, notify, messages,
}) {
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const changed = () => {
    setEditing(null);
    afterChange();
  };

  const confirmDelete = async () => {
    try {
      await remove(deleting);
      notify(messages.deleted, "success");
      changed();
    } catch (err) {
      notify(getErrorMessage(err, messages.deleteFailed), "error");
    }
    setDeleting(null);
  };

  return {
    editing, setEditing, deleting, setDeleting, changed, confirmDelete,
  };
}
