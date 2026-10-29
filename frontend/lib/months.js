// Month helpers for plans and reports. Months are "YYYY-MM" strings.

const FORMAT = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" });
const DAY_FORMAT = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" });

export function currentMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// offsets relative to this month, e.g. [-5..1] -> six past months and next month.
export function monthOptions(offsets, now = new Date()) {
  return offsets.map((offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { value: currentMonth(date), label: FORMAT.format(date) };
  });
}

// "2026-11-03" -> "03 Nov" (date-only, never shifted by the browser's time zone).
export function shortDay(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return DAY_FORMAT.format(new Date(y, m - 1, d));
}
