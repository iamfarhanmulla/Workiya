// Date helpers for visit plans. Dates are plain "YYYY-MM-DD" strings in the company's own
// time zone (the database converts them to timestamps), so the maths here is UTC-only.

const SUNDAY = 0;

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function fromIso(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}

// "2026-11" -> { month: "2026-11", start: "2026-11-01", end: "2026-11-30" }
function monthRange(month) {
  const start = fromIso(`${month}-01`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { month, start: toIso(start), end: toIso(end) };
}

// Mon-Sat days of the month, starting no earlier than "fromIso" (today in the company's zone).
function workingDays(month, todayIso) {
  const { start, end } = monthRange(month);
  const days = [];
  const first = todayIso > start ? todayIso : start;
  for (let day = fromIso(first); toIso(day) <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() !== SUNDAY) days.push(toIso(day));
  }
  return days;
}

// Index of the least-loaded day within "radius" of target (closest wins on a tie).
function leastLoadedNear(load, target, radius) {
  const candidates = [target];
  for (let offset = 1; offset <= radius; offset += 1) {
    candidates.push(target - offset, target + offset);
  }
  return candidates
    .filter((index) => index >= 0 && index < load.length)
    .reduce((best, index) => (load[index] < load[best] ? index : best), target);
}

// Spreads every needed visit of ONE rep over the working days: each account's visits are
// evenly spaced, and among nearby days the one with the fewest visits already is chosen, so a
// rep with many accounts does not get them all on the same day.
// needs: [{ key, count }] -> Map(key -> ["YYYY-MM-DD", ...])
function spreadVisits(days, needs) {
  const load = days.map(() => 0);
  const result = new Map();
  needs.forEach(({ key, count }) => {
    const dates = [];
    const radius = Math.max(0, Math.floor(days.length / (2 * Math.max(count, 1))));
    for (let i = 0; i < count && days.length > 0; i += 1) {
      const target = Math.min(days.length - 1, Math.floor(((i + 0.5) * days.length) / count));
      const index = leastLoadedNear(load, target, radius);
      load[index] += 1;
      dates.push(days[index]);
    }
    result.set(key, dates.sort());
  });
  return result;
}

module.exports = {
  monthRange, workingDays, spreadVisits, toIso,
};
