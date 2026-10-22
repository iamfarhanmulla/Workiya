import {
  canSubmitReport, isOverdue, isoToLocalInput, localInputToIso, statusMoves,
} from "./activityConfig";

const OWN = { id: 1, assignedTo: 7, status: "Pending" };
const REP = { id: 7, roleCode: "EMPLOYEE" };

describe("activityConfig", () => {
  it("round-trips a datetime-local value through ISO UTC", () => {
    // Arrange
    const local = "2026-10-21T14:30";

    // Act
    const iso = localInputToIso(local);

    // Assert
    expect(iso).toMatch(/Z$/);
    expect(isoToLocalInput(iso)).toBe(local);
    expect(localInputToIso("")).toBeNull();
    expect(isoToLocalInput(null)).toBe("");
  });

  it("gives staff every other status", () => {
    // Arrange
    const admin = { id: 1, roleCode: "ADMIN" };

    // Act
    const moves = statusMoves(OWN, admin, true);

    // Assert
    expect(moves.map((m) => m.status)).toEqual(["InProgress", "Completed", "Cancelled", "Missed"]);
  });

  it("limits an EMPLOYEE to start or back to pending on their own activity", () => {
    // Arrange
    const inProgress = { ...OWN, status: "InProgress" };

    // Act
    const fromPending = statusMoves(OWN, REP, false);
    const fromInProgress = statusMoves(inProgress, REP, false);
    const othersActivity = statusMoves({ ...OWN, assignedTo: 8 }, REP, false);
    const completed = statusMoves({ ...OWN, status: "Completed" }, REP, false);

    // Assert
    expect(fromPending).toEqual([{ status: "InProgress", label: "Start" }]);
    expect(fromInProgress).toEqual([{ status: "Pending", label: "Back to Pending" }]);
    expect(othersActivity).toEqual([]);
    expect(completed).toEqual([]);
  });

  it("allows a report only on the rep's own open activity", () => {
    // Arrange
    const completed = { ...OWN, status: "Completed" };

    // Act
    const results = [
      canSubmitReport(OWN, REP), canSubmitReport(completed, REP), canSubmitReport(OWN, null),
    ];

    // Assert
    expect(results).toEqual([true, false, false]);
  });

  it("flags only open activities past their due time as overdue", () => {
    // Arrange
    const past = "2020-01-01T00:00:00Z";

    // Act
    const results = [
      isOverdue({ status: "Pending", dueAtUtc: past }),
      isOverdue({ status: "Completed", dueAtUtc: past }),
      isOverdue({ status: "Pending", dueAtUtc: null }),
    ];

    // Assert
    expect(results).toEqual([true, false, false]);
  });
});
