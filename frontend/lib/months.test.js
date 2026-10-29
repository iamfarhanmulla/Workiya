import { currentMonth, monthOptions, shortDay } from "./months";

describe("months", () => {
  const NOW = new Date(2026, 9, 29); // 29 Oct 2026, local time

  it("formats the current month as YYYY-MM", () => {
    // Act
    const month = currentMonth(NOW);

    // Assert
    expect(month).toBe("2026-10");
  });

  it("builds options across a year boundary", () => {
    // Act
    const options = monthOptions([0, 1, 2, 3], NOW);

    // Assert
    expect(options.map((o) => o.value)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
    expect(options[0].label).toMatch(/October 2026/);
  });

  it("shows a date-only value without shifting it", () => {
    // Act
    const day = shortDay("2026-11-03");

    // Assert
    expect(day).toMatch(/03 Nov/);
    expect(shortDay(null)).toBe("—");
  });
});
