const { buildDemoPlan, previousMonth, seededRandom } = require("./demoReportPlan");

describe("demoReportPlan", () => {
  it("builds 3 reps, 8 doctors and one assignment per doctor", () => {
    // Act
    const plan = buildDemoPlan({ companyId: 1, index: 0, today: "2026-10-29" });

    // Assert
    expect(plan.reps).toHaveLength(3);
    expect(plan.doctors).toHaveLength(8);
    expect(plan.assignments.map((a) => a.rep)).toEqual([0, 1, 2, 0, 1, 2, 0, 1]);
    const perMonth = plan.assignments.map((a) => a.visitsPerMonth);
    expect(perMonth.every((n) => n >= 2 && n <= 4)).toBe(true);
  });

  it("covers last month and this month with past visits done or missed, later ones pending", () => {
    // Act
    const { visits, assignments } = buildDemoPlan({ companyId: 2, index: 1, today: "2026-10-29" });

    // Assert
    const perMonth = assignments.reduce((sum, a) => sum + a.visitsPerMonth, 0);
    expect(visits).toHaveLength(perMonth * 2);
    expect(new Set(visits.map((v) => v.month))).toEqual(new Set(["2026-09", "2026-10"]));
    visits.forEach((v) => {
      expect(new Date(`${v.date}T00:00:00Z`).getUTCDay()).not.toBe(0);
      const expected = v.date < "2026-10-29" ? ["Completed", "Missed"] : ["Pending"];
      expect(expected).toContain(v.status);
      expect(v.review === null).toBe(v.status !== "Completed");
    });
  });

  it("gives the strong rep a better completion rate than the weak rep", () => {
    // Act
    const { visits } = buildDemoPlan({ companyId: 1, index: 0, today: "2026-10-29" });

    // Assert
    const rate = (rep) => {
      const past = visits.filter((v) => v.rep === rep && v.status !== "Pending");
      return past.filter((v) => v.status === "Completed").length / past.length;
    };
    expect(rate(0)).toBeGreaterThan(rate(2));
    const neglected = visits.filter((v) => v.doctor === 5 && v.month === "2026-10");
    expect(neglected.length).toBeGreaterThan(0);
    expect(neglected.every((v) => v.status !== "Completed")).toBe(true);
  });

  it("uses different names per company and is the same on every run", () => {
    // Act
    const first = buildDemoPlan({ companyId: 1, index: 0, today: "2026-10-29" });
    const second = buildDemoPlan({ companyId: 2, index: 1, today: "2026-10-29" });

    // Assert
    expect(first.reps[0].firstName).not.toBe(second.reps[0].firstName);
    expect(first.doctors[0].name).not.toBe(second.doctors[0].name);
    expect(buildDemoPlan({ companyId: 1, index: 0, today: "2026-10-29" })).toEqual(first);
  });

  it("steps back a month across a year boundary and repeats a seeded sequence", () => {
    // Assert
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-10")).toBe("2026-09");
    const a = seededRandom(5);
    const b = seededRandom(5);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});
