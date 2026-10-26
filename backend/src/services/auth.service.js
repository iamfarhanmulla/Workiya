const crypto = require("node:crypto");
const config = require("../config/env");
const userRepository = require("../repositories/user.repository");
const refreshTokenRepository = require("../repositories/refreshToken.repository");
const passwordService = require("./password.service");
const tokenService = require("./token.service");
const auditService = require("./audit.service");
const AppError = require("../utils/AppError");
const { toUserDto } = require("./userDto");
const { ERROR_CODES } = require("../constants/errorCodes");
const { AUDIT_EVENTS } = require("../constants/auditEvents");

const ENTITY_USER = "User";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";
const ROTATED = "ROTATED";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function invalidCredentials() {
  return new AppError(401, ERROR_CODES.AUTH_INVALID_CREDENTIALS, INVALID_CREDENTIALS_MESSAGE);
}

function refreshInvalid() {
  return new AppError(
    401,
    ERROR_CODES.AUTH_REFRESH_INVALID,
    "Session is no longer valid. Please sign in again.",
  );
}

function isLocked(row, now) {
  return Boolean(row.lockout_end_at) && new Date(row.lockout_end_at) > now;
}

// Unknown emails burn the same hash cost as the scheme real users are stored with.
function dummyScheme() {
  return config.auth.passwordRehashOnLogin
    ? passwordService.PASSWORD_SCHEMES.ARGON2ID
    : passwordService.PASSWORD_SCHEMES.PBKDF2;
}

function audit(eventType, ctx, fields = {}) {
  return auditService.log({
    eventType,
    entityType: ENTITY_USER,
    ipAddress: ctx.ip,
    userAgent: ctx.userAgent,
    ...fields,
  });
}

function userAuditFields(row) {
  return { entityId: row.id, companyId: row.company_id, performedBy: row.id };
}

function refreshExpiry(isPersistent, now) {
  const lifetimeMs = isPersistent
    ? config.refresh.persistentDays * DAY_MS
    : config.refresh.sessionHours * HOUR_MS;
  return new Date(now.getTime() + lifetimeMs);
}

async function issueSession(user, {
  familyId, isPersistent, expiresAtUtc, ctx, refreshToken,
}) {
  const tokenId = await refreshTokenRepository.insert({
    userId: user.id,
    companyId: user.companyId,
    tokenHash: tokenService.hashRefreshToken(refreshToken),
    familyId,
    isPersistent,
    expiresAtUtc,
    createdByIp: ctx.ip || null,
    userAgent: ctx.userAgent || null,
  });
  const session = {
    user,
    accessToken: tokenService.signAccessToken(user),
    refreshToken,
    isPersistent,
    refreshExpiresAt: expiresAtUtc,
  };
  return { tokenId, session };
}

async function handleFailedPassword(row, ctx) {
  const { failedLoginCount, lockoutEndUtc } = await userRepository.recordFailedLogin(row.id, {
    maxFailedLogins: config.auth.maxFailedLogins,
    lockoutMinutes: config.auth.lockoutMinutes,
  });
  await audit(AUDIT_EVENTS.AUTH_LOGIN_FAILED, ctx, {
    ...userAuditFields(row),
    newValue: { reason: "INVALID_PASSWORD", failedLoginCount },
  });
  if (lockoutEndUtc && failedLoginCount >= config.auth.maxFailedLogins) {
    await audit(AUDIT_EVENTS.AUTH_ACCOUNT_LOCKED, ctx, {
      ...userAuditFields(row),
      newValue: { lockoutEndUtc: lockoutEndUtc.toISOString() },
    });
  }
  throw invalidCredentials();
}

async function rehashIfNeeded(row, password, ctx) {
  if (!config.auth.passwordRehashOnLogin || !passwordService.needsRehash(row)) {
    return;
  }
  const hashed = await passwordService.hashPassword(password);
  await userRepository.updatePasswordHash(row.id, hashed);
  await audit(AUDIT_EVENTS.AUTH_PASSWORD_REHASHED, ctx, {
    ...userAuditFields(row),
    oldValue: { algorithm: "PBKDF2-SHA256" },
    newValue: { algorithm: "Argon2id" },
  });
}

// Unknown, locked and wrong-password attempts all hash once and return the same 401,
// so neither the body nor the timing tells an attacker whether an account exists.
async function login({
  email, password, rememberMe, ip, userAgent,
}) {
  const ctx = { ip, userAgent };
  const now = new Date();
  const row = await userRepository.findActiveByEmail(email);

  if (!row) {
    await passwordService.dummyVerify(dummyScheme());
    await audit(AUDIT_EVENTS.AUTH_LOGIN_FAILED, ctx, {
      newValue: { reason: "UNKNOWN_EMAIL", email },
    });
    throw invalidCredentials();
  }
  const passwordMatches = await passwordService.verifyPassword(row, password);
  if (isLocked(row, now)) {
    await audit(AUDIT_EVENTS.AUTH_LOGIN_FAILED, ctx, {
      ...userAuditFields(row), newValue: { reason: "LOCKED" },
    });
    throw invalidCredentials();
  }
  if (!passwordMatches) {
    return handleFailedPassword(row, ctx);
  }

  await rehashIfNeeded(row, password, ctx);
  await userRepository.recordSuccessfulLogin(row.id);
  const isPersistent = rememberMe === true;
  const { session } = await issueSession(toUserDto(row), {
    refreshToken: tokenService.generateRefreshToken(),
    familyId: crypto.randomUUID(),
    isPersistent,
    expiresAtUtc: refreshExpiry(isPersistent, now),
    ctx,
  });
  await audit(AUDIT_EVENTS.AUTH_LOGIN_SUCCESS, ctx, {
    ...userAuditFields(row), newValue: { rememberMe: isPersistent },
  });
  return session;
}

async function handleReuse(record, ctx) {
  await refreshTokenRepository.revokeFamily(record.family_id, "REUSE_DETECTED");
  await audit(AUDIT_EVENTS.AUTH_REFRESH_REUSE_DETECTED, ctx, {
    entityId: record.user_id,
    companyId: record.company_id,
    performedBy: record.user_id,
    newValue: { familyId: record.family_id },
  });
  throw new AppError(
    401,
    ERROR_CODES.AUTH_REFRESH_REUSED,
    "Session is no longer valid. Please sign in again.",
  );
}

function isRecentRotation(record) {
  if (record.revoked_reason !== ROTATED || !record.revoked_at) {
    return false;
  }
  const revokedForMs = Date.now() - new Date(record.revoked_at).getTime();
  return revokedForMs < config.refresh.reuseGraceSeconds * 1000;
}

// Another tab rotated this token moments ago and the browser already holds its new cookies.
// Answer without issuing tokens, so the caller retries with those cookies instead of tripping
// reuse detection. A real replay is still caught once the grace window has passed.
async function concurrentRefresh(userId) {
  const row = await userRepository.findActiveById(userId);
  if (!row) {
    throw refreshInvalid();
  }
  return { user: toUserDto(row), rotatedConcurrently: true };
}

// The new token is stored before the old one is revoked, so a family revoke triggered by a
// concurrent presenter of the old token always covers the new row as well.
async function rotate(record, user, ctx) {
  const { tokenId, session } = await issueSession(user, {
    refreshToken: tokenService.generateRefreshToken(),
    familyId: record.family_id,
    isPersistent: Boolean(record.is_persistent),
    expiresAtUtc: new Date(record.expires_at),
    ctx,
  });
  const newHash = tokenService.hashRefreshToken(session.refreshToken);
  if (await refreshTokenRepository.revoke(record.id, ROTATED, newHash)) {
    return session;
  }
  await refreshTokenRepository.revoke(tokenId, "RACE_LOST");
  return concurrentRefresh(record.user_id);
}

async function refresh({ refreshToken, ip, userAgent }) {
  const ctx = { ip, userAgent };
  if (!refreshToken) {
    throw refreshInvalid();
  }
  const tokenHash = tokenService.hashRefreshToken(refreshToken);
  const record = await refreshTokenRepository.findByHash(tokenHash);
  if (!record) {
    throw refreshInvalid();
  }
  if (record.revoked_at || record.replaced_by_token_hash) {
    return isRecentRotation(record) ? concurrentRefresh(record.user_id) : handleReuse(record, ctx);
  }
  if (new Date(record.expires_at) <= new Date()) {
    throw refreshInvalid();
  }

  const row = await userRepository.findActiveById(record.user_id);
  if (!row) {
    await refreshTokenRepository.revokeFamily(record.family_id, "USER_INACTIVE");
    throw refreshInvalid();
  }
  return rotate(record, toUserDto(row), ctx);
}

async function logout({ refreshToken, ip, userAgent }) {
  if (!refreshToken) {
    return;
  }
  const tokenHash = tokenService.hashRefreshToken(refreshToken);
  const record = await refreshTokenRepository.findByHash(tokenHash);
  if (!record) {
    return;
  }
  await refreshTokenRepository.revokeFamily(record.family_id, "LOGOUT");
  await audit(AUDIT_EVENTS.AUTH_LOGOUT, { ip, userAgent }, {
    entityId: record.user_id,
    companyId: record.company_id,
    performedBy: record.user_id,
  });
}

async function me(userId) {
  const row = await userRepository.findActiveById(userId);
  if (!row) {
    throw new AppError(401, ERROR_CODES.AUTH_REQUIRED, "Authentication required.");
  }
  return toUserDto(row);
}

module.exports = {
  login, refresh, logout, me,
};
