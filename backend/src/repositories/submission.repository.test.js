jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const submissionRepository = require("./submission.repository");
const { rows, affected } = require("../../test/helpers/mockDb");

const COMPANY_SCOPE = { companyId: 2, unrestricted: false, userId: null };

function lockRow(overrides = {}) {
  return rows({
    status: "InProgress", assigned_to: 30, activity_type_id: 1, account_id: 3, ...overrides,
  });
}

function rulesRow(overrides = {}) {
  return rows({ geofence_meters: null, open_submissions: 0, ...overrides });
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
  db.reset();
});

describe("submission.repository reads", () => {
  it("lists with filters, a literal search and paging", async () => {
    // Arrange
    db.reset([rows({ total: 1 }), rows({ id: 40 })]);

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
    expect(page).toEqual({ total: 1, rows: [{ id: 40 }] });
    expect(db.calls[1].params).toEqual({
      scopeCompanyId: 2,
      scopeUserId: 30,
      reviewStatus: "Pending",
      activityId: 5,
      submittedBy: 30,
      search: "%a\\_b%",
      offset: 0,
      pageSize: 20,
    });
    expect(db.calls[1].text).toContain("s.submitted_by = @scopeUserId");
    expect(db.calls[1].text).toContain("s.notes ILIKE @search");
  });

  it("finds a submission or the activity to submit, or null", async () => {
    // Arrange
    db.reset([rows({ id: 40 }), rows(), rows({ id: 5 })]);

    // Act
    const found = await submissionRepository.findById(40, COMPANY_SCOPE);
    const missing = await submissionRepository.findById(41, COMPANY_SCOPE);
    const activity = await submissionRepository.findActivityForSubmission(5, COMPANY_SCOPE);

    // Assert
    expect([found, missing, activity]).toEqual([{ id: 40 }, null, { id: 5 }]);
    expect(db.calls[2].text).toContain("t.geofence_meters");
    expect(db.calls[2].params).toEqual({ activityId: 5, scopeCompanyId: 2 });
  });
});

describe("submission.repository.createAndCompleteActivity", () => {
  it("locks, inserts and completes the activity in one committed transaction", async () => {
    // Arrange
    db.reset([lockRow(), rulesRow(), rows({ id: 40 }), affected(1)]);

    // Act
    const result = await submissionRepository.createAndCompleteActivity(SUBMIT);

    // Assert
    expect(result).toEqual({ id: 40, previousStatus: "InProgress" });
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const [lock, rules, insert, complete] = db.statements();
    expect(lock.text).toMatch(/FROM activities a[\s\S]*FOR UPDATE/);
    expect(rules.text).toContain("FOR SHARE OF t, acc");
    expect(rules.params).toEqual({
      activityId: 5, companyId: 2, activityTypeId: 1, accountId: 3,
    });
    expect(insert.text).toContain("INSERT INTO submissions");
    expect(insert.text).toContain("RETURNING id");
    expect(insert.params).toMatchObject({
      activityId: 5,
      companyId: 2,
      userId: 30,
      checkInAt: new Date("2026-10-21T10:00:00Z"),
      checkOutAt: null,
      answers: "{}",
    });
    expect(complete.text).toContain("status = 'Completed', completed_at = now()");
  });

  it.each([
    ["NOT_FOUND", [rows()]],
    ["NOT_ASSIGNEE", [lockRow({ assigned_to: 31 })]],
    ["STATUS", [lockRow({ status: "Completed" })]],
    ["DUPLICATE", [lockRow(), rulesRow({ open_submissions: 1 })]],
  ])("reports %s without inserting", async (error, responses) => {
    // Arrange
    db.reset(responses);

    // Act
    const result = await submissionRepository.createAndCompleteActivity(SUBMIT);

    // Assert
    expect(result.error).toBe(error);
    expect(db.statements()).toHaveLength(responses.length);
    expect(db.statements().map((call) => call.text).join()).not.toContain("INSERT");
  });

  it("reports the blocking status of an activity that is not open", async () => {
    // Arrange
    db.reset([lockRow({ status: "Cancelled" })]);

    // Act
    const result = await submissionRepository.createAndCompleteActivity(SUBMIT);

    // Assert
    expect(result).toEqual({ error: "STATUS", status: "Cancelled" });
  });

  it("runs verify on the locked row and rolls back without inserting when it throws", async () => {
    // Arrange
    db.reset([lockRow(), rulesRow({ geofence_meters: 100, account_latitude: null })]);
    const verify = jest.fn(() => {
      throw new Error("outside");
    });

    // Act
    const result = submissionRepository.createAndCompleteActivity({ ...SUBMIT, verify });

    // Assert
    await expect(result).rejects.toThrow("outside");
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({
      geofence_meters: 100, status: "InProgress",
    }));
    expect(db.statements()).toHaveLength(2);
    expect(db.transactionLog()).toEqual(["BEGIN", "ROLLBACK"]);
  });

  it("binds NULL for missing optional values and a check-out time when given", async () => {
    // Arrange
    db.reset([lockRow({ status: "Pending" }), rulesRow(), rows({ id: 41 }), affected(1)]);

    // Act
    const result = await submissionRepository.createAndCompleteActivity({
      ...SUBMIT, values: { checkOutAtUtc: "2026-10-21T11:00:00Z", answers: { a: 1 } },
    });

    // Assert
    expect(result).toEqual({ id: 41, previousStatus: "Pending" });
    expect(db.statements()[2].params).toMatchObject({
      checkInAt: null,
      checkInLatitude: null,
      checkOutAt: new Date("2026-10-21T11:00:00Z"),
      rating: null,
      answers: "{\"a\":1}",
    });
  });
});

describe("submission.repository.review", () => {
  it("reviews a Pending submission and re-opens the activity on rejection", async () => {
    // Arrange
    db.reset([
      rows({
        company_id: 2, activity_id: 5, review_status: "Pending", activity_status: "Completed",
      }),
      affected(1),
      affected(1),
    ]);

    // Act
    const result = await submissionRepository.review({
      id: 40, scope: COMPANY_SCOPE, status: "Rejected", comment: "Redo", userId: 20,
    });

    // Assert
    expect(result).toEqual({
      companyId: 2, activityId: 5, activityStatus: "Completed", reopened: true,
    });
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
    const [lock, reviewed, reopen] = db.statements();
    expect(lock.text).toContain("FOR UPDATE OF s, a");
    expect(lock.params).toEqual({ id: 40, scopeCompanyId: 2 });
    expect(reviewed.params).toEqual({
      id: 40, status: "Rejected", comment: "Redo", userId: 20,
    });
    expect(reopen.text).toContain("status = 'InProgress', completed_at = NULL");
    expect(reopen.text).toContain("AND status = 'Completed'");
    expect(reopen.params).toEqual({ activityId: 5, companyId: 2, userId: 20 });
  });

  it("approves without touching an activity, and never re-opens a Cancelled one", async () => {
    // Arrange
    const pending = (activityStatus) => rows({
      company_id: 2, activity_id: 5, review_status: "Pending", activity_status: activityStatus,
    });
    db.reset([pending("Completed"), affected(1), pending("Cancelled"), affected(1)]);

    // Act
    const approved = await submissionRepository.review({
      id: 40, scope: COMPANY_SCOPE, status: "Approved", userId: 20,
    });
    const rejected = await submissionRepository.review({
      id: 41, scope: COMPANY_SCOPE, status: "Rejected", userId: 20,
    });

    // Assert
    expect([approved.reopened, rejected.reopened]).toEqual([false, false]);
    expect(db.statements()).toHaveLength(4);
    expect(db.statements()[1].params).toMatchObject({ status: "Approved", comment: null });
  });

  it.each([
    ["NOT_FOUND", rows()],
    ["STATUS", rows({ company_id: 2, activity_id: 5, review_status: "Approved" })],
    ["SELF_REVIEW", rows({
      company_id: 2, activity_id: 5, submitted_by: 20, review_status: "Pending",
    })],
  ])("reports %s without writing", async (error, lock) => {
    // Arrange
    db.reset([lock]);

    // Act
    const result = await submissionRepository.review({
      id: 40, scope: COMPANY_SCOPE, status: "Approved", userId: 20,
    });

    // Assert
    expect(result.error).toBe(error);
    expect(db.statements()).toHaveLength(1);
  });
});
