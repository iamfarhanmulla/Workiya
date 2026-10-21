const { legacyPbkdf2Row } = require("./pbkdf2");

const TEST_PASSWORD = "Correct#Pass1";
const HOUR_MS = 60 * 60 * 1000;
const credentials = legacyPbkdf2Row(TEST_PASSWORD);

function userRow(overrides = {}) {
  return {
    Id: 11,
    CompanyId: 2,
    RoleId: 4,
    RoleCode: "MANAGER",
    RoleName: "Manager",
    Username: "mgr",
    Email: "mgr@example.com",
    DisplayName: "Mgr",
    FirstName: "M",
    MiddleName: null,
    LastName: "G",
    PhoneNumber: null,
    Status: 1,
    FailedLoginCount: 0,
    LockoutEndUtc: null,
    ...credentials,
    ...overrides,
  };
}

function tokenRecord(overrides = {}) {
  return {
    Id: 100,
    UserId: 11,
    CompanyId: 2,
    FamilyId: "fam-1",
    IsPersistent: true,
    ExpiresAtUtc: new Date(Date.now() + HOUR_MS),
    RevokedAtUtc: null,
    ReplacedByTokenHash: null,
    ...overrides,
  };
}

function installFakeTokenStore(repository) {
  const store = [];
  let nextId = 1;
  repository.insert.mockImplementation(async (token) => {
    const id = nextId;
    nextId += 1;
    store.push({
      Id: id,
      UserId: token.userId,
      CompanyId: token.companyId,
      TokenHash: token.tokenHash,
      FamilyId: token.familyId,
      IsPersistent: token.isPersistent,
      ExpiresAtUtc: token.expiresAtUtc,
      RevokedAtUtc: null,
      ReplacedByTokenHash: null,
    });
    return id;
  });
  repository.findByHash.mockImplementation(
    async (hash) => store.find((t) => t.TokenHash === hash) || null,
  );
  repository.revoke.mockImplementation(async (id, reason, replacedBy) => {
    const token = store.find((t) => t.Id === id && !t.RevokedAtUtc);
    if (!token) {
      return false;
    }
    Object.assign(token, {
      RevokedAtUtc: new Date(), RevokedReason: reason, ReplacedByTokenHash: replacedBy,
    });
    return true;
  });
  repository.revokeFamily.mockImplementation(async (familyId, reason) => {
    store
      .filter((t) => t.FamilyId === familyId && !t.RevokedAtUtc)
      .forEach((t) => Object.assign(t, { RevokedAtUtc: new Date(), RevokedReason: reason }));
  });
  return store;
}

module.exports = {
  TEST_PASSWORD, HOUR_MS, userRow, tokenRecord, installFakeTokenStore,
};
