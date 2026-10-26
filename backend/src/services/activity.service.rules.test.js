jest.mock("../repositories/activity.repository");
jest.mock("./audit.service");

const activityRepository = require("../repositories/activity.repository");
const audit = require("./audit.service");
const activityService = require("./activity.service");
const { USERS } = require("../../test/helpers/apiHarness");
const { activityRow, context } = require("../../test/helpers/fieldWorkFixtures");

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

describe("activity.service.changeActivityStatus", () => {
  it("lets the assignee start their activity", async () => {
    // Arrange
    activityRepository.findById
      .mockResolvedValueOnce(activityRow())
      .mockResolvedValueOnce(activityRow({ status: "InProgress" }));
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
    activityRepository.findById.mockResolvedValue(activityRow({ status: "InProgress" }));

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
