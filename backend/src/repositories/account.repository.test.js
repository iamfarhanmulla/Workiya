jest.mock("../config/db", () => jest.requireActual("../../test/helpers/mockDb").mockDb());

const db = require("../config/db");
const accountRepository = require("./account.repository");
const { rows, affected } = require("../../test/helpers/mockDb");
const { USERS } = require("../../test/helpers/apiHarness");

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
  db.reset();
});

describe("account.repository list", () => {
  it("limits an EMPLOYEE to their company and their active assignments", async () => {
    // Arrange
    db.reset([rows({ total: 1 }), rows({ id: 5 })]);
    const scope = { user: USERS.employee, companyId: null, assignedUserId: 30 };

    // Act
    const result = await accountRepository.list(scope, {
      page: 2, pageSize: 10, search: "50%_off\\", isActive: null,
    });

    // Assert
    expect(result).toEqual({ total: 1, rows: [{ id: 5 }] });
    const [count, page] = db.calls;
    expect(count.text).toMatch(/^SELECT COUNT\(\*\) AS total FROM accounts a WHERE/);
    expect(page.text).toContain("NOT a.is_deleted");
    expect(page.text).toContain("a.company_id = @scopeCompanyId");
    expect(page.text).toContain("aa.account_id = a.id AND NOT aa.is_deleted AND aa.user_id = @me");
    expect(page.text).toContain("a.name ILIKE @search");
    expect(page.text).toContain("ORDER BY a.name, a.id");
    expect(page.text).toContain("LIMIT @pageSize OFFSET @offset");
    expect(page.params).toMatchObject({
      scopeCompanyId: 2, me: 30, offset: 10, pageSize: 10, search: "%50\\%\\_off\\\\%",
    });
    expect(page.text).not.toContain("50%_off");
  });

  it(
    "lets SUPER_ADMIN filter by one company and by active flag without assignment scoping",
    async () => {
      // Arrange
      db.reset([rows({ total: 0 }), rows()]);
      const scope = { user: USERS.superAdmin, companyId: 7, assignedUserId: null };

      // Act
      const result = await accountRepository.list(scope, {
        page: 1, pageSize: 50, search: null, isActive: false,
      });

      // Assert
      expect(result).toEqual({ total: 0, rows: [] });
      const { text, params } = db.calls[1];
      expect(text).toContain("TRUE");
      expect(text).toContain("a.company_id = @filterCompanyId");
      expect(text).toContain("a.is_active = @isActive");
      expect(text).not.toContain("@me");
      expect(text).not.toContain("@search");
      expect(params).toMatchObject({ filterCompanyId: 7, isActive: false, offset: 0 });
      expect(params).not.toHaveProperty("scopeCompanyId");
    },
  );
});

describe("account.repository findById", () => {
  it.each([
    [[rows({ id: 3 })], { id: 3 }],
    [[rows()], null],
  ])("returns the scoped row or null", async (responses, expected) => {
    // Arrange
    db.reset(responses);

    // Act
    const row = await accountRepository.findById(3, { user: USERS.manager });

    // Assert
    expect(row).toEqual(expected);
    expect(db.calls[0].text).toContain("a.id = @id AND NOT a.is_deleted");
    expect(db.calls[0].params).toEqual({ id: 3, scopeCompanyId: 2 });
  });

  it("runs on the caller's transaction when one is given", async () => {
    // Arrange
    const tx = { query: jest.fn().mockResolvedValue(rows()) };

    // Act
    await accountRepository.findById(3, { user: USERS.superAdmin }, tx);

    // Assert
    expect(tx.query).toHaveBeenCalledTimes(1);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe("account.repository writes", () => {
  it("inserts an account with audit columns and extra fields as a jsonb object", async () => {
    // Arrange
    db.reset([rows({ id: 9 })]);

    // Act
    const id = await accountRepository.insert(2, FIELDS, 20);

    // Assert
    expect(id).toBe(9);
    const { text, params } = db.calls[0];
    expect(text).toContain("RETURNING id");
    expect(text).toContain("@extraFields, @userId, @userId");
    expect(params).toMatchObject({
      companyId: 2,
      userId: 20,
      name: "City Clinic",
      latitude: 18.52,
      extraFields: { tier: "A" },
    });
  });

  it("stores no extra fields as NULL", async () => {
    // Arrange
    db.reset([rows({ id: 9 })]);

    // Act
    await accountRepository.insert(2, { ...FIELDS, extraFields: {} }, 20);

    // Assert
    expect(db.calls[0].params.extraFields).toBeNull();
  });

  it.each([
    ["update", (repo) => repo.update(4, 2, FIELDS, 20), "name = @name"],
    ["setStatus", (repo) => repo.setStatus(4, 2, false, 20), "is_active = @isActive"],
    ["softDelete", (repo) => repo.softDelete(4, 2, 20), "is_deleted = true"],
  ])("%s targets one live account of the company and stamps updated_by", async (
    _name,
    act,
    fragment,
  ) => {
    // Arrange
    db.reset([affected(1)]);

    // Act
    const count = await act(accountRepository);

    // Assert
    expect(count).toBe(1);
    const { text, params } = db.calls[0];
    expect(text).toContain(fragment);
    expect(text).toContain("WHERE id = @id AND company_id = @companyId AND NOT is_deleted");
    expect(text).toContain("updated_at = now(), updated_by = @userId");
    expect(params).toMatchObject({ id: 4, companyId: 2, userId: 20 });
  });
});

describe("account.repository withTransaction", () => {
  it("delegates to the shared transaction helper", async () => {
    // Arrange
    const work = async (tx) => {
      await accountRepository.softDelete(4, 2, 20, tx);
      return "done";
    };

    // Act
    const result = await accountRepository.withTransaction(work);

    // Assert
    expect(result).toBe("done");
    expect(db.withTransaction).toHaveBeenCalledWith(work);
    expect(db.transactionLog()).toEqual(["BEGIN", "COMMIT"]);
  });
});
