const { ROLES } = require("../constants/roles");
const {
  toId, isSuperAdmin, resolveCompanyId, companyFilter, manageableUserFilter, roleFilter
} = require("./tenantScope");

const SUPER = { id: 1, companyId: null, roleCode: ROLES.SUPER_ADMIN };
const ADMIN = { id: 2, companyId: 7, roleCode: ROLES.ADMIN };

function fakeRequest() {
  const inputs = {};
  return {
    inputs,
    input(name, _type, value) {
      inputs[name] = value;
      return this;
    }
  };
}

describe("tenantScope", () => {
  it.each([
    [undefined, null],
    [null, null],
    ["", null],
    ["7", 7]
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
    [ADMIN, "8", { allowed: false, companyId: null }]
  ])("resolveCompanyId(%o, %p)", (user, requested, expected) => {
    // Arrange / Act
    const result = resolveCompanyId(user, requested);

    // Assert
    expect(result).toEqual(expected);
  });

  it("does not filter a SUPER_ADMIN", () => {
    // Arrange
    const request = fakeRequest();

    // Act
    const predicates = [companyFilter(request, SUPER, "c"), manageableUserFilter(request, SUPER)];

    // Assert
    expect(predicates).toEqual(["1 = 1", "1 = 1"]);
    expect(request.inputs).toEqual({});
  });

  it("limits other callers to their own company", () => {
    // Arrange
    const request = fakeRequest();

    // Act
    const predicate = companyFilter(request, ADMIN, "d.CompanyId");

    // Assert
    expect(predicate).toBe("d.CompanyId = @scopeCompanyId");
    expect(request.inputs).toEqual({ scopeCompanyId: 7 });
  });

  it("binds NULL for a caller without a company, which matches no row", () => {
    // Arrange
    const request = fakeRequest();

    // Act
    companyFilter(request, { roleCode: ROLES.ADMIN, companyId: null }, "CompanyId");

    // Assert
    expect(request.inputs.scopeCompanyId).toBeNull();
  });

  it("keeps SUPER_ADMIN accounts out of reach of other callers", () => {
    // Arrange
    const request = fakeRequest();

    // Act
    const predicate = manageableUserFilter(request, ADMIN, "u.");

    // Assert
    expect(predicate).toBe(
      "u.CompanyId = @scopeCompanyId AND u.RoleId NOT IN (SELECT Id FROM Roles WHERE Code = @superAdminCode)"
    );
    expect(request.inputs).toEqual({ scopeCompanyId: 7, superAdminCode: ROLES.SUPER_ADMIN });
  });

  it("filters by role code with and without a column prefix", () => {
    // Arrange
    const request = fakeRequest();

    // Act
    const unprefixed = roleFilter(request, ROLES.EMPLOYEE);
    const prefixed = roleFilter(request, ROLES.EMPLOYEE, "u.");

    // Assert
    expect(unprefixed).toBe("RoleId IN (SELECT Id FROM Roles WHERE Code = @roleCode)");
    expect(prefixed).toBe("u.RoleId IN (SELECT Id FROM Roles WHERE Code = @roleCode)");
    expect(request.inputs).toEqual({ roleCode: ROLES.EMPLOYEE });
  });
});
