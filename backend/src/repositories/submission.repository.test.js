const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const submissionRepository = require("./submission.repository");
const { mockPool, rows, affected } = require("../../test/helpers/apiHarness");

const COMPANY_SCOPE = { companyId: 2, unrestricted: false, userId: null };

// Adds pool.transaction() to the fake pool; its requests share the pool's response queue.
async function withTransaction(db) {
  const pool = await mockConnectDb();
  const transaction = {
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    request: () => pool.request(),
  };
  pool.transaction = () => transaction;
  return { ...db, transaction };
}

function lockRow(overrides = {}) {
  return rows({
    Status: "InProgress", AssignedTo: 30, OpenSubmissions: 0, ...overrides,
  });
}

const SUBMIT = {
  companyId: 2,
  activityId: 5,
  userId: 30,
  values: {
    checkInAtUtc: "2026-10-21T10:00:00Z", checkInLatitude: 19.1, checkInLongitude: 72.9,
  },
};

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("submission.repository reads", () => {
  it("lists with filters, a literal search and paging", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [{ recordsets: [[{ Total: 1 }], [{ Id: 40 }]] }]);

    // Act
    const page = await submissionRepository.list(
      { companyId: 2, unrestricted: false, userId: 30 },
      {
        page: 1,
        pageSize: 20,
        reviewStatus: "Pending",
        activityId: 5,
        submittedBy: 30,
        search: "a_b",
      },
    );

    // Assert
    expect(page).toEqual({ total: 1, rows: [{ Id: 40 }] });
    expect(db.queries[0].inputs).toEqual({
      scopeCompanyId: 2,
      scopeUserId: 30,
      reviewStatus: "Pending",
      activityId: 5,
      submittedBy: 30,
      search: "%a\\_b%",
      offset: 0,
      pageSize: 20,
    });
    expect(db.queries[0].text).toContain("s.SubmittedBy = @scopeUserId");
  });

  it("finds a submission or the activity to submit, or null", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 40 }), rows(), rows({ Id: 5 })]);

    // Act
    const found = await submissionRepository.findById(40, COMPANY_SCOPE);
    const missing = await submissionRepository.findById(41, COMPANY_SCOPE);
    const activity = await submissionRepository.findActivityForSubmission(5, COMPANY_SCOPE);

    // Assert
    expect([found, missing, activity]).toEqual([{ Id: 40 }, null, { Id: 5 }]);
    expect(db.queries[2].text).toContain("t.GeofenceMeters");
    expect(db.queries[2].inputs).toEqual({ activityId: 5, scopeCompanyId: 2 });
  });
});

describe("submission.repository.createAndCompleteActivity", () => {
  it("locks, inserts and completes the activity in one committed transaction", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [lockRow(), rows({ Id: 40 })]));

    // Act
    const result = await submissionRepository.createAndCompleteActivity(SUBMIT);

    // Assert
    expect(result).toEqual({ id: 40, previousStatus: "InProgress" });
    expect(db.transaction.begin).toHaveBeenCalled();
    expect(db.transaction.commit).toHaveBeenCalled();
    expect(db.transaction.rollback).not.toHaveBeenCalled();
    const [lock, write] = db.queries;
    expect(lock.text).toMatch(/Submissions s WITH \(UPDLOCK, HOLDLOCK\)/);
    expect(lock.text).toMatch(/Activities a WITH \(UPDLOCK, HOLDLOCK\)/);
    expect(write.text).toContain("INSERT INTO Submissions");
    expect(write.text).toContain("Status = N'Completed', CompletedAtUtc = GETUTCDATE()");
    expect(write.inputs).toMatchObject({
      activityId: 5,
      companyId: 2,
      userId: 30,
      checkInAtUtc: new Date("2026-10-21T10:00:00Z"),
      checkOutAtUtc: null,
      answers: "{}",
    });
  });

  it.each([
    ["NOT_FOUND", rows()],
    ["NOT_ASSIGNEE", lockRow({ AssignedTo: 31 })],
    ["STATUS", lockRow({ Status: "Completed" })],
    ["DUPLICATE", lockRow({ OpenSubmissions: 1 })],
  ])("rolls back and reports %s without inserting", async (error, lock) => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [lock]));

    // Act
    const result = await submissionRepository.createAndCompleteActivity(SUBMIT);

    // Assert
    expect(result.error).toBe(error);
    expect(db.transaction.rollback).toHaveBeenCalled();
    expect(db.transaction.commit).not.toHaveBeenCalled();
    expect(db.queries).toHaveLength(1);
  });

  it("runs verify on the locked row and rolls back without inserting when it throws", async () => {
    // Arrange
    const locked = lockRow({ GeofenceMeters: 100, AccountLatitude: null });
    const db = await withTransaction(mockPool(mockConnectDb, [locked]));
    const verify = jest.fn(() => {
      throw new Error("outside");
    });

    // Act
    const result = submissionRepository.createAndCompleteActivity({ ...SUBMIT, verify });

    // Assert
    await expect(result).rejects.toThrow("outside");
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ GeofenceMeters: 100 }));
    expect(db.queries).toHaveLength(1);
    expect(db.queries[0].text).toContain("JOIN ActivityTypes t WITH (HOLDLOCK)");
    expect(db.queries[0].text).toContain("LEFT JOIN Accounts acc WITH (HOLDLOCK)");
    expect(db.transaction.rollback).toHaveBeenCalled();
    expect(db.transaction.commit).not.toHaveBeenCalled();
  });

  it("rolls back and rethrows when a statement fails, even if rollback fails", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [lockRow(), new Error("deadlock")]));
    db.transaction.rollback.mockRejectedValue(new Error("aborted"));

    // Act
    const result = submissionRepository.createAndCompleteActivity(SUBMIT);

    // Assert
    await expect(result).rejects.toThrow("deadlock");
    expect(db.transaction.rollback).toHaveBeenCalled();
  });
});

describe("submission.repository.review", () => {
  it("reviews a Pending submission and re-opens the activity on rejection", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [
      rows({
        CompanyId: 2, ActivityId: 5, ReviewStatus: "Pending", ActivityStatus: "Completed",
      }),
      affected(1),
    ]));

    // Act
    const result = await submissionRepository.review({
      id: 40, scope: COMPANY_SCOPE, status: "Rejected", comment: "Redo", userId: 20,
    });

    // Assert
    expect(result).toEqual({
      companyId: 2, activityId: 5, activityStatus: "Completed", reopened: true,
    });
    expect(db.transaction.commit).toHaveBeenCalled();
    expect(db.queries[0].text).toMatch(/WITH \(UPDLOCK, HOLDLOCK\)/);
    expect(db.queries[0].inputs).toEqual({ id: 40, scopeCompanyId: 2 });
    expect(db.queries[1].text).toContain("IF @reopen = 1");
    expect(db.queries[1].text).toContain("Status = N'InProgress', CompletedAtUtc = NULL");
    expect(db.queries[1].text).toContain("AND Status = N'Completed'");
    expect(db.queries[1].inputs).toEqual({
      reopen: 1,
      id: 40,
      status: "Rejected",
      comment: "Redo",
      userId: 20,
      activityId: 5,
      companyId: 2,
    });
  });

  it("does not re-open an activity that is no longer Completed", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [
      rows({
        CompanyId: 2, ActivityId: 5, ReviewStatus: "Pending", ActivityStatus: "Cancelled",
      }),
      affected(1),
    ]));

    // Act
    const result = await submissionRepository.review({
      id: 40, scope: COMPANY_SCOPE, status: "Rejected", userId: 20,
    });

    // Assert
    expect(result.reopened).toBe(false);
    expect(db.queries[1].inputs.reopen).toBe(0);
  });

  it.each([
    ["NOT_FOUND", rows()],
    ["STATUS", rows({ CompanyId: 2, ActivityId: 5, ReviewStatus: "Approved" })],
    ["SELF_REVIEW", rows({
      CompanyId: 2, ActivityId: 5, SubmittedBy: 20, ReviewStatus: "Pending",
    })],
  ])("rolls back with %s", async (error, lock) => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [lock]));

    // Act
    const result = await submissionRepository.review({
      id: 40, scope: COMPANY_SCOPE, status: "Approved", userId: 20,
    });

    // Assert
    expect(result.error).toBe(error);
    expect(db.transaction.rollback).toHaveBeenCalled();
    expect(db.queries).toHaveLength(1);
  });
});

describe("submission.repository optional values", () => {
  it("binds NULL for missing optional values and a check-out time when given", async () => {
    // Arrange
    const db = await withTransaction(mockPool(mockConnectDb, [
      lockRow({ Status: "Pending" }), rows({ Id: 41 }),
      rows({ CompanyId: 2, ActivityId: 5, ReviewStatus: "Pending" }), affected(1),
    ]));

    // Act
    await submissionRepository.createAndCompleteActivity({
      ...SUBMIT, values: { checkOutAtUtc: "2026-10-21T11:00:00Z", answers: { a: 1 } },
    });
    await submissionRepository.review({
      id: 41, scope: COMPANY_SCOPE, status: "Approved", userId: 20,
    });

    // Assert
    expect(db.queries[1].inputs).toMatchObject({
      checkInAtUtc: null,
      checkInLatitude: null,
      checkOutAtUtc: new Date("2026-10-21T11:00:00Z"),
      rating: null,
      answers: "{\"a\":1}",
    });
    expect(db.queries[3].inputs).toMatchObject({ status: "Approved", comment: null });
  });
});
