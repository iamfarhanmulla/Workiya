const mockConnectDb = jest.fn();

jest.mock("../config/db", () => ({ sql: jest.requireActual("mssql"), connectDb: mockConnectDb }));

const accountRepository = require("./account.repository");
const {
  USERS, mockPool, rows, affected,
} = require("../../test/helpers/apiHarness");

function paged(total, ...recordset) {
  return { recordsets: [[{ Total: total }], recordset], recordset: [{ Total: total }] };
}

const FIELDS = {
  name: "City Clinic",
  phoneNumber: null,
  email: "a@b.co",
  address: null,
  city: "Pune",
  state: null,
  country: null,
  latitude: 18.52,
  longitude: 73.85,
  photoUrl: null,
  notes: null,
  extraFields: { tier: "A" },
};

beforeEach(() => {
  mockConnectDb.mockReset();
});

describe("account.repository list", () => {
  it("limits an EMPLOYEE to their company and their active assignments", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [paged(1, { Id: 5 })]);
    const scope = { user: USERS.employee, companyId: null, assignedUserId: 30 };

    // Act
    const result = await accountRepository.list(scope, {
      page: 2, pageSize: 10, search: "50%_off", isActive: null,
    });

    // Assert
    expect(result).toEqual({ total: 1, rows: [{ Id: 5 }] });
    const { text, inputs } = db.queries[0];
    expect(text).toContain("a.IsDeleted = 0");
    expect(text).toContain("a.CompanyId = @scopeCompanyId");
    expect(text).toContain("aa.AccountId = a.Id AND aa.IsDeleted = 0 AND aa.UserId = @me");
    expect(text).toContain("OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY");
    expect(inputs).toMatchObject({
      scopeCompanyId: 2, me: 30, offset: 10, pageSize: 10, search: "%50[%][_]off%",
    });
    expect(text).not.toContain("50%_off");
  });

  it(
    "lets SUPER_ADMIN filter by one company and by active flag without assignment scoping",
    async () => {
      // Arrange
      const db = mockPool(mockConnectDb, [paged(0)]);
      const scope = { user: USERS.superAdmin, companyId: 7, assignedUserId: null };

      // Act
      const result = await accountRepository.list(scope, {
        page: 1, pageSize: 50, search: null, isActive: false,
      });

      // Assert
      expect(result).toEqual({ total: 0, rows: [] });
      const { text, inputs } = db.queries[0];
      expect(text).toContain("a.CompanyId = @filterCompanyId");
      expect(text).toContain("a.IsActive = @isActive");
      expect(text).not.toContain("@me");
      expect(text).not.toContain("@search");
      expect(inputs).toMatchObject({ filterCompanyId: 7, isActive: false, offset: 0 });
    },
  );
});

describe("account.repository findById", () => {
  it.each([
    [[rows({ Id: 3 })], { Id: 3 }],
    [[rows()], null],
  ])("returns the scoped row or null", async (responses, expected) => {
    // Arrange
    const db = mockPool(mockConnectDb, responses);

    // Act
    const row = await accountRepository.findById(3, { user: USERS.manager });

    // Assert
    expect(row).toEqual(expected);
    expect(db.queries[0].text).toContain("a.Id = @id AND a.IsDeleted = 0");
    expect(db.queries[0].inputs).toMatchObject({ id: 3, scopeCompanyId: 2 });
  });

  it("runs on the caller's transaction when one is given", async () => {
    // Arrange
    const fakeRequest = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue(rows()),
    };
    const tx = { request: jest.fn(() => fakeRequest) };

    // Act
    await accountRepository.findById(3, { user: USERS.superAdmin }, tx);

    // Assert
    expect(tx.request).toHaveBeenCalledTimes(1);
    expect(mockConnectDb).not.toHaveBeenCalled();
  });
});

describe("account.repository writes", () => {
  it("inserts an account with audit columns and serialized extra fields", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 9 })]);

    // Act
    const id = await accountRepository.insert(2, FIELDS, 20);

    // Assert
    expect(id).toBe(9);
    expect(db.queries[0].text).toContain("OUTPUT INSERTED.Id");
    expect(db.queries[0].text).toContain("GETUTCDATE(), @userId, GETUTCDATE(), @userId");
    expect(db.queries[0].inputs).toMatchObject({
      companyId: 2,
      userId: 20,
      name: "City Clinic",
      latitude: 18.52,
      extraFields: "{\"tier\":\"A\"}",
    });
  });

  it("stores no extra fields as NULL", async () => {
    // Arrange
    const db = mockPool(mockConnectDb, [rows({ Id: 9 })]);

    // Act
    await accountRepository.insert(2, { ...FIELDS, extraFields: {} }, 20);

    // Assert
    expect(db.queries[0].inputs.extraFields).toBeNull();
  });

  it.each([
    ["update", (repo) => repo.update(4, 2, FIELDS, 20), "Name = @name"],
    ["setStatus", (repo) => repo.setStatus(4, 2, false, 20), "IsActive = @isActive"],
    ["softDelete", (repo) => repo.softDelete(4, 2, 20), "IsDeleted = 1"],
  ])("%s targets one live account of the company and stamps UpdatedBy", async (
    _name,
    act,
    fragment,
  ) => {
    // Arrange
    const db = mockPool(mockConnectDb, [affected(1)]);

    // Act
    const count = await act(accountRepository);

    // Assert
    expect(count).toBe(1);
    const { text, inputs } = db.queries[0];
    expect(text).toContain(fragment);
    expect(text).toContain("WHERE Id = @id AND CompanyId = @companyId AND IsDeleted = 0");
    expect(text).toContain("UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId");
    expect(inputs).toMatchObject({ id: 4, companyId: 2, userId: 20 });
  });
});

describe("account.repository withTransaction", () => {
  function fakeTransaction(overrides = {}) {
    const tx = {
      begin: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
      ...overrides,
    };
    mockConnectDb.mockResolvedValue({ transaction: () => tx });
    return tx;
  }

  it("commits and returns the work's result", async () => {
    // Arrange
    const tx = fakeTransaction();

    // Act
    const result = await accountRepository.withTransaction(async (t) => (t === tx ? "done" : "x"));

    // Assert
    expect(result).toBe("done");
    expect(tx.begin).toHaveBeenCalled();
    expect(tx.commit).toHaveBeenCalled();
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it("rolls back and rethrows when the work fails", async () => {
    // Arrange
    const tx = fakeTransaction();
    const error = new Error("boom");

    // Act
    const run = accountRepository.withTransaction(async () => {
      throw error;
    });

    // Assert
    await expect(run).rejects.toBe(error);
    expect(tx.rollback).toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it("still rethrows the original error when the rollback itself fails", async () => {
    // Arrange
    fakeTransaction({ rollback: jest.fn().mockRejectedValue(new Error("aborted")) });
    const error = new Error("boom");

    // Act
    const run = accountRepository.withTransaction(async () => {
      throw error;
    });

    // Assert
    await expect(run).rejects.toBe(error);
  });
});
