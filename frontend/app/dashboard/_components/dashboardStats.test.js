import {
  byRep, completionTone, dayRange, summarize,
} from "./dashboardStats";

const act = (status, assignedTo = 1, assignedToName = "Priya Deshmukh") => ({
  status, assignedTo, assignedToName,
});

describe("dayRange", () => {
  it("covers the local calendar day from midnight to the last millisecond", () => {
    // Arrange
    const now = new Date(2026, 9, 22, 15, 30);

    // Act
    const { dateFrom, dateTo } = dayRange(now);

    // Assert
    expect(new Date(dateFrom)).toEqual(new Date(2026, 9, 22, 0, 0, 0, 0));
    expect(new Date(dateTo)).toEqual(new Date(2026, 9, 22, 23, 59, 59, 999));
  });
});

describe("summarize", () => {
  it("counts each status and leaves cancelled out of planned", () => {
    // Arrange
    const items = ["Completed", "Completed", "Pending", "Missed", "Cancelled"].map((s) => act(s));

    // Act
    const result = summarize(items);

    // Assert
    expect(result.byStatus).toEqual({
      Pending: 1, InProgress: 0, Completed: 2, Cancelled: 1, Missed: 1,
    });
    expect(result.planned).toBe(4);
    expect(result.completion).toBe(50);
  });

  it("reports 0% when nothing is planned", () => {
    // Arrange / Act
    const result = summarize([]);

    // Assert
    expect(result.planned).toBe(0);
    expect(result.completion).toBe(0);
  });
});

describe("byRep", () => {
  it("groups by assignee, skips cancelled and sorts by completion", () => {
    // Arrange
    const items = [
      act("Completed", 1, "Priya"), act("Pending", 1, "Priya"),
      act("Completed", 2, "Karthik"), act("Cancelled", 2, "Karthik"),
      act("Missed", 3, "Imran"),
      act("Pending", null, null),
    ];

    // Act
    const rows = byRep(items);

    // Assert
    expect(rows.map((r) => [r.name, r.planned, r.done, r.missed, r.pct])).toEqual([
      ["Karthik", 1, 1, 0, 100],
      ["Priya", 2, 1, 0, 50],
      ["Imran", 1, 0, 1, 0],
      ["Unassigned", 1, 0, 0, 0],
    ]);
  });
});

describe("completionTone", () => {
  it.each([[100, "success"], [85, "success"], [84, "warning"], [60, "warning"], [59, "danger"]])(
    "%i%% is %s",
    (pct, tone) => {
      // Arrange / Act / Assert
      expect(completionTone(pct)).toBe(tone);
    },
  );
});
