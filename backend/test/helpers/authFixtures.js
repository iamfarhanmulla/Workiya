const { legacyPbkdf2Row } = require("./pbkdf2");

const TEST_PASSWORD = "Correct#Pass1";
const HOUR_MS = 60 * 60 * 1000;
const credentials = legacyPbkdf2Row(TEST_PASSWORD);

// A users row as user.repository returns it (snake_case columns).
function userRow(overrides = {}) {
  return {
    id: 11,
    company_id: 2,
    role_id: 4,
    role_code: "MANAGER",
    role_name: "Manager",
    username: "mgr",
    email: "mgr@example.com",
    display_name: "Mgr",
    first_name: "M",
    middle_name: null,
    last_name: "G",
    phone_number: null,
    status: 1,
    failed_login_count: 0,
    lockout_end_at: null,
    ...credentials,
    ...overrides,
  };
}

// A refresh_tokens row as refreshToken.repository returns it.
function tokenRecord(overrides = {}) {
  return {
    id: 100,
    user_id: 11,
    company_id: 2,
    family_id: "fam-1",
    is_persistent: true,
    expires_at: new Date(Date.now() + HOUR_MS),
    revoked_at: null,
    revoked_reason: null,
    replaced_by_token_hash: null,
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
      id,
      user_id: token.userId,
      company_id: token.companyId,
      token_hash: token.tokenHash,
      family_id: token.familyId,
      is_persistent: token.isPersistent,
      expires_at: token.expiresAtUtc,
      revoked_at: null,
      revoked_reason: null,
      replaced_by_token_hash: null,
    });
    return id;
  });
  repository.findByHash.mockImplementation(
    async (hash) => store.find((t) => t.token_hash === hash) || null,
  );
  repository.revoke.mockImplementation(async (id, reason, replacedBy) => {
    const token = store.find((t) => t.id === id && !t.revoked_at);
    if (!token) {
      return false;
    }
    Object.assign(token, {
      revoked_at: new Date(), revoked_reason: reason, replaced_by_token_hash: replacedBy,
    });
    return true;
  });
  repository.revokeFamily.mockImplementation(async (familyId, reason) => {
    store
      .filter((t) => t.family_id === familyId && !t.revoked_at)
      .forEach((t) => Object.assign(t, { revoked_at: new Date(), revoked_reason: reason }));
  });
  return store;
}

module.exports = {
  TEST_PASSWORD, HOUR_MS, userRow, tokenRecord, installFakeTokenStore,
};
