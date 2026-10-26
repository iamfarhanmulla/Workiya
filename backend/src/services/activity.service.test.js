jest.mock("../repositories/activity.repository");
jest.mock("./audit.service");
jest.mock("./companyContext");

const activityRepository = require("../repositories/activity.repository");
const audit = require("./audit.service");
const { requireCompanyId } = require("./companyContext");
const activityService = require("./activity.service");
const { USERS } = require("../../test/helpers/apiHarness");
const { NOW, activityRow, context } = require("../../test/helpers/fieldWorkFixtures");

const FIELDS = {
  activityTypeId: 1, accountId: 3, assignedTo: 30, title: "Visit", priority: "Medium",
};

beforeEach(() => {
  audit.log.mockResolvedValue(undefined);
});

describe("activity.service reads", () => {
  it("lists a page of DTOs with the latest submission", async () => {
    // Arrange
    activityRepository.list.mockResolvedValue({
      total: 1,
      rows: [activityRow({
        latest_submission_id: 9,
        latest_submission_review_status: "Pending",
        latest_submission_submitted_at: NOW,
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
      .mockResolvedValueOnce(activityRow({ description: "keep" }))
      .mockResolvedValueOnce(activityRow({ assigned_to: 31, title: "New" }));
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

describe("activity.service foreign key violations", () => {
  const fkError = () => Object.assign(new Error("fk"), { code: "23503" });

  it("maps a rejected insert to 400 CROSS_COMPANY_REFERENCE", async () => {
    // Arrange
    requireCompanyId.mockReturnValue(2);
    activityRepository.checkReferences.mockResolvedValue(true);
    activityRepository.insert.mockRejectedValue(fkError());

    // Act
    const result = activityService.createActivity(context(USERS.admin), FIELDS);

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 400, errorCode: "CROSS_COMPANY_REFERENCE",
    });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("maps a rejected update to 400 and rethrows any other error", async () => {
    // Arrange
    activityRepository.findById.mockResolvedValue(activityRow());
    activityRepository.checkReferences.mockResolvedValue(true);
    activityRepository.update
      .mockRejectedValueOnce(fkError())
      .mockRejectedValueOnce(new Error("connection lost"));

    // Act
    const rejected = await activityService
      .updateActivity(context(USERS.admin), 5, { assignedTo: 40 })
      .catch((err) => err);
    const failed = await activityService
      .updateActivity(context(USERS.admin), 5, { title: "x" })
      .catch((err) => err);

    // Assert
    expect(rejected).toMatchObject({ status: 400, errorCode: "CROSS_COMPANY_REFERENCE" });
    expect(failed.message).toBe("connection lost");
  });
});
