const { ROLES } = require("../constants/roles");
const { requireCompanyId } = require("./companyContext");

const SUPER = { id: 1, companyId: null, roleCode: ROLES.SUPER_ADMIN };
const ADMIN = { id: 2, companyId: 7, roleCode: ROLES.ADMIN };

function errorOf(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return null;
}

describe("companyContext.requireCompanyId", () => {
  it.each([[undefined], [null], [""], ["7"], [7]])("pins a non-super-admin (%p)", (requested) => {
    // Arrange / Act
    const companyId = requireCompanyId(ADMIN, requested);

    // Assert
    expect(companyId).toBe(7);
  });

  it.each([[8], ["abc"]])("refuses another company for a non-super-admin (%p)", (requested) => {
    // Arrange / Act
    const err = errorOf(() => requireCompanyId(ADMIN, requested));

    // Assert
    expect(err).toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
  });

  it("refuses a non-super-admin without a company", () => {
    // Arrange
    const orphan = { id: 3, companyId: null, roleCode: ROLES.EMPLOYEE };

    // Act
    const err = errorOf(() => requireCompanyId(orphan, undefined));

    // Assert
    expect(err).toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
  });

  it("lets SUPER_ADMIN act on the company they name", () => {
    // Arrange / Act
    const companyId = requireCompanyId(SUPER, "3");

    // Assert
    expect(companyId).toBe(3);
  });

  it.each([[undefined], [null], [""]])("requires SUPER_ADMIN to name one (%p)", (requested) => {
    // Arrange / Act
    const err = errorOf(() => requireCompanyId(SUPER, requested));

    // Assert
    expect(err).toMatchObject({ status: 400, errorCode: "COMPANY_REQUIRED" });
  });

  it.each([["abc"], [-1], [1.5]])("rejects a bad SUPER_ADMIN company (%p)", (requested) => {
    // Arrange / Act
    const err = errorOf(() => requireCompanyId(SUPER, requested));

    // Assert
    expect(err).toMatchObject({ status: 400, errorCode: "VALIDATION_FAILED" });
  });
});
