jest.mock("../repositories/activity.repository");
jest.mock("./audit.service");
jest.mock("./companyContext");

const activityRepository = require("../repositories/activity.repository");
const audit = require("./audit.service");
const { requireCompanyId } = require("./companyContext");
const activityService = require("./activity.service");
const { USERS } = require("../../test/helpers/apiHarness");

const NOW = new Date("2026-10-21T10:00:00.000Z");

function activityRow(overrides = {}) {
  return {
    Id: 5,
    CompanyId: 2,
    ActivityTypeId: 1,
    ActivityTypeName: "Doctor Visit",
    AccountId: 3,
    AccountName: "Dr. Rao",
    AssignedTo: USERS.employee.id,
    AssignedToName: "Emp",
    AssignedBy: USERS.manager.id,
    AssignedByName: "Mgr",
    Title: "Visit",
    Description: null,
    Status: "Pending",
    Priority: "Medium",
    DueAtUtc: null,
    CompletedAtUtc: null,
    CreatedAtUtc: NOW,
    LatestSubmissionId: null,
    ...overrides,
  };
}

function context(user) {
  return { user, ip: "10.0.0.1", userAgent: "jest" };
}

const FIELDS = {
  activityTypeId: 1, accountId: 3, assignedTo: 30, title: "Visit", priority: "Medium",
};

beforeEach(() => {
  audit.log.mockResolvedValue(undefined);
});

describe("activity.service.canTransition", () => {
  it.each([
    ["EMPLOYEE", "Pending", "InProgress", true],
    ["EMPLOYEE", "InProgress", "Pending", true],
    ["EMPLOYEE", "Pending", "Completed", false],
    ["EMPLOYEE", "InProgress", "Completed", false],
    ["EMPLOYEE", "Pending", "Cancelled", false],
    ["EMPLOYEE", "Completed", "InProgress", false],
    ["EMPLOYEE", "Missed", "Pending", false],
    ["EMPLOYEE", "Pending", "Pending", false],
    ["MANAGER", "Completed", "Pending", true],
    ["ADMIN", "Pending", "Cancelled", true],
    ["SUPER_ADMIN", "InProgress", "Missed", true],
    ["MANAGER", "Pending", "Archived", false],
    [undefined, "Pending", "Completed", false],
  ])("%s: %s -> %s is %s", (roleCode, from, to, expected) => {
    // Arrange / Act
    const allowed = activityService.canTransition(roleCode, from, to);

    // Assert
    expect(allowed).toBe(expected);
  });
});

describe("activity.service.buildScope", () => {
  it("limits an EMPLOYEE to their own company and their own rows", () => {
    // Arrange / Act
    const scope = activityService.buildScope(USERS.employee);

    // Assert
    expect(scope).toEqual({ companyId: 2, unrestricted: false, userId: USERS.employee.id });
  });

  it("gives a MANAGER the whole company", () => {
    // Arrange / Act
    const scope = activityService.buildScope(USERS.manager);

    // Assert
    expect(scope).toEqual({ companyId: 2, unrestricted: false, userId: null });
  });

  it("lets SUPER_ADMIN see everything or pick one company", () => {
    // Arrange / Act
    const all = activityService.buildScope(USERS.superAdmin);
    const one = activityService.buildScope(USERS.superAdmin, 7);

    // Assert
    expect(all).toEqual({ companyId: null, unrestricted: true, userId: null });
    expect(one).toEqual({ companyId: 7, unrestricted: false, userId: null });
  });

  it("refuses another company for a non-super-admin", () => {
    // Arrange / Act
    const act = () => activityService.buildScope(USERS.admin, 9);

    // Assert
    expect(act).toThrow(expect.objectContaining({ status: 403, errorCode: "FORBIDDEN" }));
  });
});

describe("activity.service reads", () => {
  it("lists a page of DTOs with the latest submission", async () => {
    // Arrange
    activityRepository.list.mockResolvedValue({
      total: 1,
      rows: [activityRow({
        LatestSubmissionId: 9,
        LatestSubmissionReviewStatus: "Pending",
        LatestSubmissionSubmittedAtUtc: NOW,
      })],
    });

    // Act
    const page = await activityService.listActivities(USERS.employee, {
      page: 1, pageSize: 50, status: "Pending",
    });

    // Assert
    expect(activityRepository.list).toHaveBeenCalledWith(
      { companyId: 2, unrestricted: false, userId: USERS.employee.id },
      { page: 1, pageSize: 50, status: "Pending" },
    );
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    expect(page.items[0]).toMatchObject({
      id: 5,
      accountName: "Dr. Rao",
      createdAtUtc: NOW.toISOString(),
      latestSubmission: { id: 9, reviewStatus: "Pending", submittedAtUtc: NOW.toISOString() },
    });
  });

  it("returns 404 when the activity is outside the caller's scope", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(null);

    // Act
    const result = activityService.getActivity(USERS.employee, 5);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    expect(activityRepository.findById).toHaveBeenCalledWith(5, expect.objectContaining({
      userId: USERS.employee.id,
    }));
  });

  it("returns one activity as a DTO with null latestSubmission", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());

    // Act
    const dto = await activityService.getActivity(USERS.manager, 5);

    // Assert
    expect(dto).toMatchObject({ id: 5, status: "Pending", latestSubmission: null });
  });
});

describe("activity.service.createActivity", () => {
  it("creates in the resolved company, assigned by the caller, and audits", async () => {
    // Arrange
    requireCompanyId.mockReturnValue(2);
    activityRepository.checkReferences.mockResolvedValue(true);
    activityRepository.insert.mockResolvedValue(5);
    activityRepository.findById.mockResolvedValue(activityRow());

    // Act
    const dto = await activityService.createActivity(context(USERS.manager), {
      ...FIELDS, companyId: undefined,
    });

    // Assert
    expect(activityRepository.checkReferences).toHaveBeenCalledWith(2, FIELDS);
    expect(activityRepository.insert).toHaveBeenCalledWith(2, FIELDS, USERS.manager.id);
    expect(dto.id).toBe(5);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_CREATED",
      entityType: "Activity",
      entityId: 5,
      companyId: 2,
      performedBy: USERS.manager.id,
      ipAddress: "10.0.0.1",
      userAgent: "jest",
    }));
  });

  it("rejects references from another company with 400 CROSS_COMPANY_REFERENCE", async () => {
    // Arrange
    requireCompanyId.mockReturnValue(2);
    activityRepository.checkReferences.mockResolvedValue(false);

    // Act
    const result = activityService.createActivity(context(USERS.admin), FIELDS);

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 400, errorCode: "CROSS_COMPANY_REFERENCE",
    });
    expect(activityRepository.insert).not.toHaveBeenCalled();
  });

  it("fails with 404 if the new row cannot be read back", async () => {
    // Arrange
    requireCompanyId.mockReturnValue(2);
    activityRepository.checkReferences.mockResolvedValue(true);
    activityRepository.insert.mockResolvedValue(5);
    activityRepository.findById.mockResolvedValue(null);

    // Act
    const result = activityService.createActivity(context(USERS.admin), FIELDS);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});

describe("activity.service.updateActivity", () => {
  it("re-checks only changed references and merges untouched fields", async () => {
    // Arrange
    activityRepository.findById
      .mockResolvedValueOnce(activityRow({ Description: "keep" }))
      .mockResolvedValueOnce(activityRow({ AssignedTo: 31, Title: "New" }));
    activityRepository.checkReferences.mockResolvedValue(true);
    activityRepository.update.mockResolvedValue(1);

    // Act
    const dto = await activityService.updateActivity(context(USERS.manager), 5, {
      assignedTo: 31, title: "New",
    });

    // Assert
    expect(activityRepository.checkReferences).toHaveBeenCalledWith(2, {
      accountId: null, activityTypeId: null, assignedTo: 31,
    });
    expect(activityRepository.update).toHaveBeenCalledWith(5, 2, {
      activityTypeId: 1,
      accountId: 3,
      assignedTo: 31,
      title: "New",
      description: "keep",
      priority: "Medium",
      dueAtUtc: null,
    }, USERS.manager.id);
    expect(dto).toMatchObject({ assignedTo: 31, title: "New" });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_UPDATED",
      oldValue: expect.objectContaining({ title: "Visit" }),
      newValue: expect.objectContaining({ title: "New" }),
    }));
  });

  it("skips the reference check when no reference changes", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());
    activityRepository.update.mockResolvedValue(1);

    // Act
    await activityService.updateActivity(context(USERS.manager), 5, { accountId: 3, title: "x" });

    // Assert
    expect(activityRepository.checkReferences).not.toHaveBeenCalled();
    expect(activityRepository.update).toHaveBeenCalled();
  });

  it("returns 404 when the row vanished before the update", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());
    activityRepository.update.mockResolvedValue(0);

    // Act
    const result = activityService.updateActivity(context(USERS.manager), 5, { title: "x" });

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404 });
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe("activity.service.changeActivityStatus", () => {
  it("lets the assignee start their activity", async () => {
    // Arrange
    activityRepository.findById
      .mockResolvedValueOnce(activityRow())
      .mockResolvedValueOnce(activityRow({ Status: "InProgress" }));
    activityRepository.updateStatus.mockResolvedValue(1);

    // Act
    const dto = await activityService.changeActivityStatus(
      context(USERS.employee),
      5,
      "InProgress",
    );

    // Assert
    expect(activityRepository.updateStatus).toHaveBeenCalledWith(
      5,
      2,
      { fromStatus: "Pending", toStatus: "InProgress" },
      USERS.employee.id,
    );
    expect(dto.status).toBe("InProgress");
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_STATUS_CHANGED",
      oldValue: { status: "Pending" },
      newValue: { status: "InProgress" },
    }));
  });

  it("returns 422 INVALID_STATUS_TRANSITION when an EMPLOYEE completes directly", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow({ Status: "InProgress" }));

    // Act
    const result = activityService.changeActivityStatus(
      context(USERS.employee),
      5,
      "Completed",
    );

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 422, errorCode: "INVALID_STATUS_TRANSITION",
    });
    expect(activityRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("returns 409 when the status changed concurrently", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());
    activityRepository.updateStatus.mockResolvedValue(0);

    // Act
    const result = activityService.changeActivityStatus(context(USERS.admin), 5, "Cancelled");

    // Assert
    await expect(result).rejects.toMatchObject({ status: 409, errorCode: "CONFLICT" });
  });
});

describe("activity.service.deleteActivity", () => {
  it("soft deletes and audits the old value", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());
    activityRepository.softDelete.mockResolvedValue(1);

    // Act
    await activityService.deleteActivity(context(USERS.admin), 5);

    // Assert
    expect(activityRepository.softDelete).toHaveBeenCalledWith(5, 2, USERS.admin.id);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_DELETED", entityId: 5, newValue: null,
    }));
  });

  it("returns 404 when nothing was deleted", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());
    activityRepository.softDelete.mockResolvedValue(0);

    // Act
    const result = activityService.deleteActivity(context(USERS.admin), 5);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});
