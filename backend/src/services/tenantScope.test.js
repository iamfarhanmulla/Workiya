const { ROLES } = require("../constants/roles");
const {
  toId, isSuperAdmin, resolveCompanyId, companyFilter, manageableUserFilter, roleFilter,
} = require("./tenantScope");

const SUPER = { id: 1, companyId: null, roleCode: ROLES.SUPER_ADMIN };
const ADMIN = { id: 2, companyId: 7, roleCode: ROLES.ADMIN };

describe("tenantScope", () => {
  it.each([
    [undefined, null],
    [null, null],
    ["", null],
    ["7", 7],
  ])("toId(%p) is %p", (input, expected) => {
    // Arrange / Act
    const result = toId(input);

    // Assert
    expect(result).toBe(expected);
  });

  it("recognises only SUPER_ADMIN as cross-company", () => {
    // Arrange / Act
    const results = [isSuperAdmin(SUPER), isSuperAdmin(ADMIN), isSuperAdmin(undefined)];

    // Assert
    expect(results).toEqual([true, false, false]);
  });

  it.each([
    [SUPER, "5", { allowed: true, companyId: 5 }],
    [SUPER, "", { allowed: true, companyId: null }],
    [ADMIN, "", { allowed: true, companyId: 7 }],
    [ADMIN, 7, { allowed: true, companyId: 7 }],
    [ADMIN, "8", { allowed: false, companyId: null }],
  ])("resolveCompanyId(%o, %p)", (user, requested, expected) => {
    // Arrange / Act
    const result = resolveCompanyId(user, requested);

    // Assert
    expect(result).toEqual(expected);
  });

  it("does not filter a SUPER_ADMIN", () => {
    // Arrange
    const params = {};

    // Act
    const predicates = [
      companyFilter(SUPER, "c.company_id", params),
      manageableUserFilter(SUPER, params),
    ];

    // Assert
    expect(predicates).toEqual(["TRUE", "TRUE"]);
    expect(params).toEqual({});
  });

  it("limits other callers to their own company", () => {
    // Arrange
    const params = { search: "x" };

    // Act
    const predicate = companyFilter(ADMIN, "d.company_id", params);

    // Assert
    expect(predicate).toBe("d.company_id = @scopeCompanyId");
    expect(params).toEqual({ search: "x", scopeCompanyId: 7 });
  });

  it("binds NULL for a caller without a company, which matches no row", () => {
    // Arrange
    const params = {};

    // Act
    companyFilter({ roleCode: ROLES.ADMIN, companyId: null }, "company_id", params);

    // Assert
    expect(params.scopeCompanyId).toBeNull();
  });

  it("keeps SUPER_ADMIN accounts out of reach of other callers", () => {
    // Arrange
    const params = {};

    // Act
    const predicate = manageableUserFilter(ADMIN, params, "u.");

    // Assert
    expect(predicate).toBe(
      "u.company_id = @scopeCompanyId"
        + " AND u.role_id NOT IN (SELECT id FROM roles WHERE code = @superAdminCode)",
    );
    expect(params).toEqual({ scopeCompanyId: 7, superAdminCode: ROLES.SUPER_ADMIN });
  });

  it("filters by role code with and without a column prefix", () => {
    // Arrange
    const params = {};

    // Act
    const unprefixed = roleFilter(ROLES.EMPLOYEE, params);
    const prefixed = roleFilter(ROLES.EMPLOYEE, params, "u.");

    // Assert
    expect(unprefixed).toBe("role_id IN (SELECT id FROM roles WHERE code = @roleCode)");
    expect(prefixed).toBe("u.role_id IN (SELECT id FROM roles WHERE code = @roleCode)");
    expect(params).toEqual({ roleCode: ROLES.EMPLOYEE });
  });
});
