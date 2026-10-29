const { monthRange, workingDays, spreadVisits } = require("./planDates");

describe("planDates.monthRange", () => {
  it.each([
    ["2026-11", "2026-11-01", "2026-11-30"],
    ["2026-12", "2026-12-01", "2026-12-31"],
    ["2028-02", "2028-02-01", "2028-02-29"],
  ])("%s spans %s..%s", (month, start, end) => {
    // Act
    const range = monthRange(month);

    // Assert
    expect(range).toEqual({ month, start, end });
  });
});

describe("planDates.workingDays", () => {
  it("lists Monday-Saturday of a future month (no Sundays)", () => {
    // Act
    const days = workingDays("2026-11", "2026-10-29");

    // Assert: November 2026 has 30 days and 5 Sundays (1, 8, 15, 22, 29)
    expect(days).toHaveLength(25);
    expect(days).not.toContain("2026-11-01");
    expect(days[0]).toBe("2026-11-02");
    expect(days.at(-1)).toBe("2026-11-30");
  });

  it("starts at today for the current month", () => {
    // Act
    const days = workingDays("2026-11", "2026-11-26");

    // Assert: 26, 27, 28 (Sat), 30 (Mon); 29 is a Sunday
    expect(days).toEqual(["2026-11-26", "2026-11-27", "2026-11-28", "2026-11-30"]);
  });

  it("returns nothing for a month that is already over", () => {
    // Act
    const days = workingDays("2026-09", "2026-10-29");

    // Assert
    expect(days).toEqual([]);
  });
});

describe("planDates.spreadVisits", () => {
  it("spaces one account's visits evenly over the month", () => {
    // Arrange
    const days = workingDays("2026-11", "2026-10-01");

    // Act
    const dates = spreadVisits(days, [{ key: "a", count: 2 }]).get("a");

    // Assert: roughly the first and second half of the month
    expect(dates).toHaveLength(2);
    expect(dates[0] < "2026-11-15").toBe(true);
    expect(dates[1] > "2026-11-15").toBe(true);
  });

  it("balances many accounts so no day gets overloaded", () => {
    // Arrange
    const days = workingDays("2026-11", "2026-10-01");
    const needs = Array.from({ length: 40 }, (_, i) => ({ key: `acc${i}`, count: 2 }));

    // Act
    const result = spreadVisits(days, needs);

    // Assert: 80 visits over 25 days -> at most 4 on any day
    const perDay = new Map();
    [...result.values()].flat().forEach((d) => perDay.set(d, (perDay.get(d) || 0) + 1));
    expect([...perDay.values()].reduce((a, b) => a + b, 0)).toBe(80);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(4);
  });

  it("creates no dates when there are no working days left", () => {
    // Act
    const dates = spreadVisits([], [{ key: "a", count: 3 }]).get("a");

    // Assert
    expect(dates).toEqual([]);
  });
});
