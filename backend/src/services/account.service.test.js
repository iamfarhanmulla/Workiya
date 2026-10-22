jest.mock("../repositories/account.repository");
jest.mock("../repositories/accountAssignment.repository");
jest.mock("./audit.service");
jest.mock("./customFields.service");
jest.mock("./companyContext");

const accountRepository = require("../repositories/account.repository");
const assignmentRepository = require("../repositories/accountAssignment.repository");
const auditService = require("./audit.service");
const customFieldsService = require("./customFields.service");
const { requireCompanyId } = require("./companyContext");
const accountService = require("./account.service");
const { USERS } = require("../../test/helpers/apiHarness");

const CTX = { ipAddress: "10.0.0.1", userAgent: "jest" };
const QUERY = {
  page: 1, pageSize: 50, search: null, isActive: null,
};
const ROW = {
  Id: 4, CompanyId: 2, Name: "City Clinic", IsActive: true, ExtraFields: "{\"tier\":\"A\"}",
};
const BODY = { name: "City Clinic", city: "Pune", extraFields: { tier: "A" } };

beforeEach(() => {
  accountRepository.withTransaction.mockImplementation((work) => work("tx"));
  assignmentRepository.listByAccountIds.mockResolvedValue([]);
  customFieldsService.validateValues.mockResolvedValue({ ok: true, value: { tier: "A" } });
  requireCompanyId.mockReturnValue(2);
});

describe("account.service read scoping", () => {
  it("passes the EMPLOYEE's own id as the assignment scope", async () => {
    // Arrange
    accountRepository.list.mockResolvedValue({ total: 0, rows: [] });

    // Act
    await accountService.list(USERS.employee, QUERY);

    // Assert
    expect(accountRepository.list).toHaveBeenCalledWith(
      { user: USERS.employee, companyId: null, assignedUserId: 30 },
      QUERY,
    );
  });

  it.each([
    [USERS.manager, undefined, { companyId: null, assignedUserId: null }],
    [USERS.superAdmin, 7, { companyId: 7, assignedUserId: null }],
  ])("does not narrow staff to assignments", async (user, companyId, expected) => {
    // Arrange
    accountRepository.list.mockResolvedValue({ total: 0, rows: [] });

    // Act
    await accountService.list(user, { ...QUERY, companyId });

    // Assert
    expect(accountRepository.list.mock.calls[0][0]).toMatchObject(expected);
  });

  it("refuses another company's list for a non-super-admin", async () => {
    // Arrange / Act
    const run = accountService.list(USERS.manager, { ...QUERY, companyId: 3 });

    // Assert
    await expect(run).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
  });

  it("groups one assignments query into each account of the page", async () => {
    // Arrange
    accountRepository.list.mockResolvedValue({ total: 2, rows: [ROW, { ...ROW, Id: 5 }] });
    assignmentRepository.listByAccountIds.mockResolvedValue([
      {
        AccountId: 4, UserId: 30, DisplayName: "Rep A", VisitsPerMonth: 2,
      },
      {
        AccountId: 4, UserId: 31, DisplayName: "Rep B", VisitsPerMonth: null,
      },
    ]);

    // Act
    const page = await accountService.list(USERS.manager, QUERY);

    // Assert
    expect(assignmentRepository.listByAccountIds).toHaveBeenCalledTimes(1);
    expect(assignmentRepository.listByAccountIds).toHaveBeenCalledWith([4, 5]);
    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 50 });
    expect(page.items[0].assignedUsers).toEqual([
      { userId: 30, displayName: "Rep A", visitsPerMonth: 2 },
      { userId: 31, displayName: "Rep B", visitsPerMonth: null },
    ]);
    expect(page.items[1].assignedUsers).toEqual([]);
  });

  it("returns 404 for an account outside an EMPLOYEE's assignments", async () => {
    // Arrange
    accountRepository.findById.mockResolvedValue(null);

    // Act
    const run = accountService.getById(USERS.employee, 4);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
    expect(accountRepository.findById.mock.calls[0][1]).toMatchObject({ assignedUserId: 30 });
  });
});

describe("account.service writes", () => {
  it("creates an account in the resolved company with validated extra fields", async () => {
    // Arrange
    accountRepository.insert.mockResolvedValue(4);
    accountRepository.findById.mockResolvedValue(ROW);

    // Act
    const dto = await accountService.create(USERS.manager, { ...BODY, companyId: 2 }, CTX);

    // Assert
    expect(requireCompanyId).toHaveBeenCalledWith(USERS.manager, 2);
    expect(customFieldsService.validateValues)
      .toHaveBeenCalledWith(2, "ACCOUNT", { tier: "A" }, { existing: undefined });
    expect(accountRepository.insert).toHaveBeenCalledWith(2, expect.objectContaining({
      name: "City Clinic", city: "Pune", email: null, extraFields: { tier: "A" },
    }), 20);
    expect(dto).toMatchObject({ id: 4, extraFields: { tier: "A" }, assignedUsers: [] });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACCOUNT_CREATED",
      entityId: 4,
      companyId: 2,
      performedBy: 20,
      ipAddress: "10.0.0.1",
    }));
  });

  it("rejects invalid extra fields with INVALID_EXTRA_FIELDS", async () => {
    // Arrange
    customFieldsService.validateValues.mockResolvedValue({ ok: false, message: "tier: unknown" });

    // Act
    const run = accountService.create(USERS.manager, BODY, CTX);

    // Assert
    await expect(run).rejects.toMatchObject({
      status: 400, errorCode: "INVALID_EXTRA_FIELDS", message: "tier: unknown",
    });
    expect(accountRepository.insert).not.toHaveBeenCalled();
  });

  it("updates within the account's own company and audits old and new values", async () => {
    // Arrange
    accountRepository.findById
      .mockResolvedValueOnce(ROW)
      .mockResolvedValueOnce({ ...ROW, Name: "New" });
    accountRepository.update.mockResolvedValue(1);

    // Act
    const dto = await accountService.update(USERS.admin, 4, { ...BODY, name: "New" }, CTX);

    // Assert
    expect(accountRepository.update)
      .toHaveBeenCalledWith(4, 2, expect.objectContaining({ name: "New" }), 10);
    expect(dto.name).toBe("New");
    const entry = auditService.log.mock.calls[0][0];
    expect(entry).toMatchObject({
      eventType: "ACCOUNT_UPDATED", oldValue: { name: "City Clinic" },
    });
    expect(entry.newValue).not.toHaveProperty("assignedUsers");
  });

  it("passes the stored extra fields so values of switched-off fields are kept", async () => {
    // Arrange
    accountRepository.findById.mockResolvedValue(ROW);
    accountRepository.update.mockResolvedValue(1);

    // Act
    await accountService.update(USERS.admin, 4, BODY, CTX);

    // Assert
    expect(customFieldsService.validateValues)
      .toHaveBeenCalledWith(2, "ACCOUNT", { tier: "A" }, { existing: { tier: "A" } });
  });

  it.each([
    ["update", (user) => accountService.update(user, 4, BODY, CTX), "update"],
    ["setStatus", (user) => accountService.setStatus(user, 4, false, CTX), "setStatus"],
  ])("%s returns 404 when the row vanished before the write", async (_name, act, method) => {
    // Arrange
    accountRepository.findById.mockResolvedValue(ROW);
    accountRepository[method].mockResolvedValue(0);

    // Act
    const run = act(USERS.manager);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 404 });
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("changes the active flag and audits the change", async () => {
    // Arrange
    accountRepository.findById.mockResolvedValue(ROW);
    accountRepository.setStatus.mockResolvedValue(1);

    // Act
    await accountService.setStatus(USERS.manager, 4, false, CTX);

    // Assert
    expect(accountRepository.setStatus).toHaveBeenCalledWith(4, 2, false, 20);
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "ACCOUNT_STATUS_CHANGED",
      oldValue: { isActive: true },
      newValue: { isActive: false },
    }));
  });

  it("soft-deletes the account and its assignments in one transaction", async () => {
    // Arrange
    accountRepository.findById.mockResolvedValue(ROW);

    // Act
    await accountService.remove(USERS.manager, 4, CTX);

    // Assert
    expect(accountRepository.withTransaction).toHaveBeenCalledTimes(1);
    expect(accountRepository.softDelete).toHaveBeenCalledWith(4, 2, 20, "tx");
    expect(assignmentRepository.softDeleteForAccount).toHaveBeenCalledWith(4, 20, "tx");
    expect(auditService.log)
      .toHaveBeenCalledWith(expect.objectContaining({ eventType: "ACCOUNT_DELETED" }));
  });

  it("returns 404 when deleting an account outside the caller's company", async () => {
    // Arrange
    accountRepository.findById.mockResolvedValue(null);

    // Act
    const run = accountService.remove(USERS.manager, 4, CTX);

    // Assert
    await expect(run).rejects.toMatchObject({ status: 404 });
    expect(accountRepository.withTransaction).not.toHaveBeenCalled();
  });
});
