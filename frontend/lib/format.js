// Display helpers shared by every page. Dates read "22 Oct 2026" (Indian English).

export function initials(name = "") {
  return (name || "").split(" ").map((w) => w[0]).join("").toUpperCase()
    .slice(0, 2) || "?";
}

export function fmtDate(iso) {
  if (!iso) return null;
  const options = { day: "numeric", month: "short", year: "numeric" };
  return new Date(iso).toLocaleDateString("en-IN", options);
}

// First + last name, else the display name, else the email.
export function personName(row) {
  const full = `${row?.FirstName || ""} ${row?.LastName || ""}`.trim();
  return row?.DisplayName || full || row?.Email || "—";
}
