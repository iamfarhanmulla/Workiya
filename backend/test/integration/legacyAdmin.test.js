const { useTestDb, closeTestDb, seedBasics } = require("./helpers/testDb");
const adminUsers = require("../../src/repositories/adminUser.repository");
const companies = require("../../src/repositories/company.repository");
const passwordService = require("../../src/services/password.service");
const { USERS } = require("../helpers/apiHarness");

const { USER, EMPLOYEE, MANAGER } = adminUsers.KINDS;
// A SUPER_ADMIN inside the ADMIN's own company: still never visible to the ADMIN.
const SUPER_ADMIN_IN_GLOBEX = 50;

// The keys the frontend reads from each legacy endpoint (contract: unchanged).
const USER_KEYS = [
  "Id", "CompanyId", "CompanyName", "RoleId", "RoleName", "ManagerId", "ManagerName",
  "Username", "Email", "FirstName", "MiddleName", "LastName", "DisplayName", "PhoneNumber",
  "ProfilePhotoUrl", "Status", "IsActive", "IsDeleted", "CreatedAtUtc", "UpdatedAtUtc",
];
const EMPLOYEE_KEYS = [
  "Id", "FirstName", "MiddleName", "LastName", "DisplayName", "Email", "PhoneNumber",
  "ProfilePhotoUrl", "CompanyId", "CompanyName", "RoleId", "RoleName", "ManagerId",
  "ManagerName", "Status", "IsActive", "CreatedAtUtc", "UpdatedAtUtc", "TaskCount", "TaskDone",
];
const MANAGER_KEYS = [
  "Id", "FirstName", "MiddleName", "LastName", "DisplayName", "Email", "PhoneNumber",
  "ProfilePhotoUrl", "CompanyId", "CompanyName", "RoleId", "RoleName", "Status", "IsActive",
  "CreatedAtUtc", "UpdatedAtUtc", "EmployeeCount", "TaskCount",
];
const COMPANY_KEYS = [
  "Id", "Name", "Key", "LogoUrl", "ContactEmail", "ContactPhone", "Address", "City",
  "Country", "Plan", "Status", "IsActive", "CreatedAtUtc", "UpdatedAtUtc", "TotalUsers",
  "EmployeeCount", "ManagerCount",
];

let db;

const sortedKeys = (row) => Object.keys(row).sort();
const ids = (rows) => rows.map((row) => row.Id).sort((a, b) => a - b);

beforeAll(async () => {
  db = await useTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await seedBasics();
  await db.query(`INSERT INTO users (id, company_id, role_id, username, first_name, last_name,
    display_name, email, password_hash)
    VALUES (@id, 2, 1, 'boss', 'Bo', 'Boss', 'Bo Boss', 'boss@globex.test', 'x')`, {
    id: SUPER_ADMIN_IN_GLOBEX,
  });
});

describe("adminUser.repository manageable-user scoping", () => {
  it("never shows an ADMIN a SUPER_ADMIN or another company's user", async () => {
    // Act
    const list = await adminUsers.list(USER, USERS.admin);
    const hidden = await adminUsers.findById(USER, USERS.admin, SUPER_ADMIN_IN_GLOBEX);
    const updated = await adminUsers.update(USER, USERS.admin, SUPER_ADMIN_IN_GLOBEX, {
      firstName: "X", lastName: "Y", displayName: "X Y", username: "x",
    });
    const deleted = await adminUsers.softDelete(USER, USERS.admin, SUPER_ADMIN_IN_GLOBEX);

    // Assert
    expect(ids(list)).toEqual([10, 20, 30]);
    expect(sortedKeys(list[0])).toEqual([...USER_KEYS].sort());
    expect(hidden).toBeNull();
    expect(updated).toBe(false);
    expect(deleted).toBe(false);
    await expect(adminUsers.existsInScope(USER, USERS.admin, 40)).resolves.toBe(false);
  });

  it("shows a SUPER_ADMIN every user", async () => {
    // Act
    const list = await adminUsers.list(USER, USERS.superAdmin);

    // Assert
    expect(ids(list)).toEqual([1, 10, 20, 30, 40, SUPER_ADMIN_IN_GLOBEX]);
  });

  it("returns employees and managers with their PascalCase keys and counts", async () => {
    // Act
    const employees = await adminUsers.list(EMPLOYEE, USERS.manager);
    const managers = await adminUsers.list(MANAGER, USERS.admin);
    const options = await adminUsers.listManagerOptions(USERS.admin);

    // Assert
    expect(employees).toHaveLength(1);
    expect(sortedKeys(employees[0])).toEqual([...EMPLOYEE_KEYS].sort());
    expect(employees[0]).toMatchObject({
      Id: 30,
      ManagerId: 20,
      ManagerName: "Max Manager",
      CompanyName: "Globex",
      RoleName: "Employee",
      IsActive: true,
      TaskCount: 0,
      TaskDone: 0,
    });
    expect(employees[0].CreatedAtUtc).toBeInstanceOf(Date);
    expect(sortedKeys(managers[0])).toEqual([...MANAGER_KEYS].sort());
    expect(managers[0]).toMatchObject({ Id: 20, EmployeeCount: 1, TaskCount: 0 });
    expect(options).toEqual([{
      Id: 20, Name: "Max Manager", CompanyId: 2, CompanyName: "Globex",
    }]);
  });

  it("creates a user, finds its email case-insensitively and keeps the company "
    + "when a SUPER_ADMIN leaves it empty", async () => {
    // Arrange
    const hashed = await passwordService.hashPassword("Str0ng!Pass");
    const id = await adminUsers.insert({
      ...hashed,
      companyId: 2,
      roleId: await adminUsers.roleIdByCode("EMPLOYEE"),
      username: "newbie",
      email: "newbie@globex.test",
      firstName: "New",
      lastName: "Bie",
      displayName: "New Bie",
      createdBy: USERS.admin.id,
    });

    // Act
    const inUse = await adminUsers.emailInUse("NEWBIE@globex.test");
    const updated = await adminUsers.update(EMPLOYEE, USERS.superAdmin, id, {
      firstName: "Renamed", lastName: "Bie", displayName: "Renamed Bie", companyId: null,
    });
    const row = await adminUsers.findById(EMPLOYEE, USERS.manager, id);

    // Assert
    expect(inUse).toBe(true);
    expect(updated).toBe(true);
    expect(row).toMatchObject({
      Id: id, FirstName: "Renamed", CompanyId: 2, ManagerId: null, IsActive: true,
    });
    await expect(adminUsers.roleCodeOf(1)).resolves.toBe("SUPER_ADMIN");
  });

  it("deactivates and soft-deletes within scope", async () => {
    // Act
    const deactivated = await adminUsers.setActive(EMPLOYEE, USERS.manager, 30, false);
    const deleted = await adminUsers.softDelete(EMPLOYEE, USERS.admin, 30);
    const outOfScope = await adminUsers.setActive(EMPLOYEE, USERS.manager, 40, false);

    // Assert
    expect([deactivated, deleted, outOfScope]).toEqual([true, true, false]);
    const { rows } = await db.query(
      "SELECT is_active, is_deleted, deleted_by, deleted_at FROM users WHERE id = 30",
    );
    expect(rows[0]).toMatchObject({ is_active: false, is_deleted: true, deleted_by: 10 });
    expect(rows[0].deleted_at).toBeInstanceOf(Date);
  });

  it("lists roles with PascalCase keys", async () => {
    // Act
    const roles = await adminUsers.listRoles();

    // Assert
    expect(roles.map((role) => role.Code)).toEqual(["ADMIN", "EMPLOYEE", "MANAGER", "SUPER_ADMIN"]);
    expect(sortedKeys(roles[0])).toEqual(["Code", "Description", "Id", "Name"]);
  });
});

describe("company.repository", () => {
  it("lists companies with user, employee and manager counts as numbers", async () => {
    // Act
    const list = await companies.list();

    // Assert
    expect(sortedKeys(list[0])).toEqual([...COMPANY_KEYS].sort());
    const byKey = Object.fromEntries(list.map((row) => [row.Key, row]));
    expect(byKey.globex).toMatchObject({ TotalUsers: 4, EmployeeCount: 1, ManagerCount: 1 });
    expect(byKey.acme).toMatchObject({ TotalUsers: 2, EmployeeCount: 1, ManagerCount: 0 });
    const one = await companies.findById(2);
    expect(one).toMatchObject({ Id: 2, Name: "Globex", TotalUsers: 4 });
    expect(one).not.toHaveProperty("UpdatedAtUtc");
  });

  it("limits the company options to the caller's company unless SUPER_ADMIN", async () => {
    // Act
    const own = await companies.listOptions(USERS.admin);
    const all = await companies.listOptions(USERS.superAdmin);

    // Assert
    expect(own).toEqual([{
      Id: 2, Name: "Globex", Key: "globex", City: null, Country: null, Plan: null,
    }]);
    expect(ids(all)).toEqual([1, 2]);
  });

  it("creates, updates, deactivates and soft-deletes a company", async () => {
    // Arrange
    const fields = {
      name: "Initech",
      key: "initech",
      logoUrl: null,
      contactEmail: null,
      contactPhone: null,
      address: null,
      city: "Austin",
      country: null,
      plan: "STARTUP",
      actorId: 1,
    };

    // Act
    const id = await companies.insert(fields);
    await companies.update(id, { ...fields, name: "Initech LLC", isActive: undefined });
    await companies.setActive(id, false, 1);
    const inactive = await companies.findById(id);
    await companies.softDelete(id, 1);

    // Assert
    expect(inactive).toMatchObject({ Name: "Initech LLC", City: "Austin", IsActive: false });
    await expect(companies.keyInUse("initech")).resolves.toBe(false);
    await expect(companies.exists(id)).resolves.toBe(false);
    await expect(companies.keyInUse("globex")).resolves.toBe(true);
  });
});
