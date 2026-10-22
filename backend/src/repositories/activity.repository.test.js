const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const activityRepository = require("./activity.repository");
const { mockPool, rows, affected } = require("../../test/helpers/apiHarness");

const COMPANY_SCOPE = { companyId: 2, unrestricted: false, userId: null };
const EMPLOYEE_SCOPE = { companyId: 2, unrestricted: false, userId: 30 };
const ALL_SCOPE = { companyId: null, unrestricted: true, userId: null };

function paged(total, ...recordset) {
  return { recordsets: [[{ Total: total }], recordset], recordset: [{ Total: total }] };
}

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("activity.repository helpers", () => {
  it("escapes LIKE wildcards so a search is literal", () => {
    // Arrange / Act
    const pattern = activityRepository.likePattern("50%_[x]\\");

    // Assert
    expect(pattern).toBe("%50\\%\\_\\[x]\\\\%");
  });
});

describe("activity.repository.list", () => {
  it("binds every filter as a parameter and pages with OFFSET/FETCH", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [paged(3, { Id: 1 })]);
    const dateFrom = new Date("2026-10-01T00:00:00Z");

    // Act
    const page = await activityRepository.list(EMPLOYEE_SCOPE, {
      page: 2,
      pageSize: 10,
      status: "Pending",
      accountId: 3,
      assignedTo: 30,
      dateFrom,
      dateTo: dateFrom,
      search: "rao' OR 1=1",
    });

    // Assert
    expect(page).toEqual({ total: 3, rows: [{ Id: 1 }] });
    const [{ text, inputs }] = db.queries;
    expect(inputs).toEqual({
      scopeCompanyId: 2,
      scopeUserId: 30,
      status: "Pending",
      accountId: 3,
      assignedTo: 30,
      dateFrom,
      dateTo: dateFrom,
      search: "%rao' OR 1=1%",
      offset: 10,
      pageSize: 10,
    });
    expect(text).toContain("a.AssignedTo = @scopeUserId");
    expect(text).toContain("OUTER APPLY");
    expect(text).toContain("ORDER BY s.SubmittedAtUtc DESC");
    expect(text).not.toContain("rao'");
  });

  it("does not filter by company for an unrestricted SUPER_ADMIN scope", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [paged(0)]);

    // Act
    await activityRepository.list(ALL_SCOPE, { page: 1, pageSize: 50 });

    // Assert
    expect(db.queries[0].inputs).toEqual({ offset: 0, pageSize: 50 });
    expect(db.queries[0].text).not.toContain("@scopeCompanyId");
  });
});

describe("activity.repository single-row operations", () => {
  it("finds one activity in scope or returns null", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 5 }), rows()]);

    // Act
    const found = await activityRepository.findById(5, COMPANY_SCOPE);
    const missing = await activityRepository.findById(6, COMPANY_SCOPE);

    // Assert
    expect(found).toEqual({ Id: 5 });
    expect(missing).toBeNull();
    expect(db.queries[0].inputs).toEqual({ id: 5, scopeCompanyId: 2 });
  });

  it("checks every reference against the activity's company and assignee roles", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [
      rows({ AccountOk: 1, ActivityTypeOk: 1, AssigneeOk: 1 }),
      rows({ AccountOk: 1, ActivityTypeOk: 0, AssigneeOk: 1 }),
      rows(),
    ]);

    // Act
    const okAll = await activityRepository.checkReferences(2, {
      accountId: 3, activityTypeId: 1, assignedTo: 30,
    });
    const badType = await activityRepository.checkReferences(2, { activityTypeId: 9 });
    const noRow = await activityRepository.checkReferences(2, {});

    // Assert
    expect([okAll, badType, noRow]).toEqual([true, false, false]);
    expect(db.queries[0].inputs).toEqual({
      companyId: 2,
      accountId: 3,
      activityTypeId: 1,
      assignedTo: 30,
      employeeCode: "EMPLOYEE",
      managerCode: "MANAGER",
    });
    expect(db.queries[1].inputs).toMatchObject({ accountId: null, assignedTo: null });
    expect(db.queries[0].text).toContain("r.Code IN (@employeeCode, @managerCode)");
  });

  it("inserts a Pending activity with audit columns and returns its id", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 77 })]);

    // Act
    const id = await activityRepository.insert(2, {
      activityTypeId: 1,
      accountId: 3,
      assignedTo: 30,
      title: "Visit",
      priority: "High",
      dueAtUtc: "2026-10-30T09:00:00Z",
    }, 20);

    // Assert
    expect(id).toBe(77);
    expect(db.queries[0].inputs).toMatchObject({
      companyId: 2, userId: 20, description: null, dueAtUtc: new Date("2026-10-30T09:00:00Z"),
    });
    expect(db.queries[0].text).toMatch(/N'Pending', @priority, @dueAtUtc, @userId, @userId/);
  });

  it("updates fields, status and soft delete with UpdatedAtUtc/UpdatedBy", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1), affected(0), affected(1)]);

    // Act
    const updated = await activityRepository.update(5, 2, {
      activityTypeId: 1, accountId: 3, assignedTo: 30, title: "T", priority: "Low", dueAtUtc: null,
    }, 20);
    const moved = await activityRepository.updateStatus(
      5,
      2,
      { fromStatus: "Pending", toStatus: "InProgress" },
      30,
    );
    const deleted = await activityRepository.softDelete(5, 2, 20);

    // Assert
    expect([updated, moved, deleted]).toEqual([1, 0, 1]);
    db.queries.forEach(({ text }) => {
      expect(text).toContain("UpdatedAtUtc = GETUTCDATE()");
      expect(text).toContain("UpdatedBy = @userId");
      expect(text).toContain("IsDeleted = 0");
    });
    expect(db.queries[1].text).toContain("Status = @fromStatus");
    expect(db.queries[2].text).toContain("SET IsDeleted = 1");
  });
});
