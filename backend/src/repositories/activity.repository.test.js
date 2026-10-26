jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const activityRepository = require("./activity.repository");
const { rows, affected } = require("../../test/helpers/mockDb");

const COMPANY_SCOPE = { companyId: 2, unrestricted: false, userId: null };
const EMPLOYEE_SCOPE = { companyId: 2, unrestricted: false, userId: 30 };
const ALL_SCOPE = { companyId: null, unrestricted: true, userId: null };

beforeEach(() => {
  db.reset();
});

describe("activity.repository helpers", () => {
  it("escapes LIKE wildcards and the escape character so a search is literal", () => {
    // Arrange / Act
    const pattern = activityRepository.likePattern("50%_[x]\\");

    // Assert
    expect(pattern).toBe("%50\\%\\_[x]\\\\%");
  });
});

describe("activity.repository.list", () => {
  it("binds every filter as a parameter and pages with OFFSET/LIMIT", async () => {
    // Arrange
    db.reset([rows({ total: 3 }), rows({ id: 1 })]);
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
    expect(page).toEqual({ total: 3, rows: [{ id: 1 }] });
    const [count, pageQuery] = db.calls;
    const filters = {
      scopeCompanyId: 2,
      scopeUserId: 30,
      status: "Pending",
      accountId: 3,
      assignedTo: 30,
      dateFrom,
      dateTo: dateFrom,
      search: "%rao' OR 1=1%",
    };
    expect(count.params).toEqual(filters);
    expect(pageQuery.params).toEqual({ ...filters, offset: 10, pageSize: 10 });
    expect(count.text).not.toContain("LATERAL");
    expect(pageQuery.text).toContain("a.assigned_to = @scopeUserId");
    expect(pageQuery.text).toContain("LEFT JOIN LATERAL");
    expect(pageQuery.text).toContain("ORDER BY s.submitted_at DESC, s.id DESC");
    expect(pageQuery.text).toContain("a.title ILIKE @search ESCAPE '\\'");
    expect(pageQuery.text).toContain("OFFSET @offset LIMIT @pageSize");
    expect(db.calls.map((call) => call.text).join()).not.toContain("rao'");
  });

  it("does not filter by company for an unrestricted SUPER_ADMIN scope", async () => {
    // Arrange
    db.reset([rows({ total: 0 }), rows()]);

    // Act
    const page = await activityRepository.list(ALL_SCOPE, { page: 1, pageSize: 50 });

    // Assert
    expect(page).toEqual({ total: 0, rows: [] });
    expect(db.calls[0].params).toEqual({});
    expect(db.calls[1].params).toEqual({ offset: 0, pageSize: 50 });
    expect(db.calls[1].text).not.toContain("@scopeCompanyId");
  });
});

describe("activity.repository reads", () => {
  it("finds one activity in scope or returns null", async () => {
    // Arrange
    db.reset([rows({ id: 5 }), rows()]);

    // Act
    const found = await activityRepository.findById(5, COMPANY_SCOPE);
    const missing = await activityRepository.findById(6, COMPANY_SCOPE);

    // Assert
    expect(found).toEqual({ id: 5 });
    expect(missing).toBeNull();
    expect(db.calls[0].params).toEqual({ id: 5, scopeCompanyId: 2 });
    expect(db.calls[0].text).toContain("NOT a.is_deleted");
  });

  it("checks every reference against the activity's company and assignee roles", async () => {
    // Arrange
    db.reset([
      rows({ account_ok: true, activity_type_ok: true, assignee_ok: true }),
      rows({ account_ok: true, activity_type_ok: false, assignee_ok: true }),
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
    expect(db.calls[0].params).toEqual({
      companyId: 2,
      accountId: 3,
      activityTypeId: 1,
      assignedTo: 30,
      employeeCode: "EMPLOYEE",
      managerCode: "MANAGER",
    });
    expect(db.calls[1].params).toMatchObject({ accountId: null, assignedTo: null });
    expect(db.calls[0].text).toContain("r.code IN (@employeeCode, @managerCode)");
  });
});

describe("activity.repository writes", () => {
  it("inserts a Pending activity with audit columns and returns its id", async () => {
    // Arrange
    db.reset([rows({ id: 77 })]);

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
    expect(db.calls[0].params).toMatchObject({
      companyId: 2, userId: 20, description: null, dueAt: new Date("2026-10-30T09:00:00Z"),
    });
    expect(db.calls[0].text).toMatch(/'Pending', @priority, @dueAt, @userId, @userId\)/);
    expect(db.calls[0].text).toContain("RETURNING id");
  });

  it("updates fields, status and soft delete with updated_at/updated_by", async () => {
    // Arrange
    db.reset([affected(1), affected(0), affected(1)]);

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
    db.calls.forEach(({ text }) => {
      expect(text).toContain("updated_at = now()");
      expect(text).toContain("updated_by = @userId");
      expect(text).toContain("NOT is_deleted");
    });
    expect(db.calls[0].params).toMatchObject({ dueAt: null, description: null });
    expect(db.calls[1].text).toContain("status = @fromStatus");
    expect(db.calls[1].params).toEqual({
      id: 5, companyId: 2, fromStatus: "Pending", toStatus: "InProgress", userId: 30,
    });
    expect(db.calls[2].text).toContain("SET is_deleted = true");
  });
});
