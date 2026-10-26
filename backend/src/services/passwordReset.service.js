const passwordService = require("./password.service");
const auditService = require("./audit.service");
const userPasswordRepository = require("../repositories/userPassword.repository");
const { AUDIT_EVENTS } = require("../constants/auditEvents");

const PASSWORD_RULE = `Password must be at least ${passwordService.MIN_PASSWORD_LENGTH} `
  + "characters.";

// The edit forms send "" when the admin leaves "New Password" empty: that means "keep it".
function readNewPassword(body) {
  const value = body ? body.password : undefined;
  if (value === undefined || value === null || value === "") {
    return { password: null, error: null };
  }
  if (!passwordService.isAcceptablePassword(value)) {
    return { password: null, error: PASSWORD_RULE };
  }
  return { password: value, error: null };
}

// Stored as Argon2id, like every new password. The password itself is never logged.
async function resetPassword(actor, userId, password, req) {
  const hashed = await passwordService.hashPassword(password);
  const result = await userPasswordRepository.resetPassword({
    userId: Number(userId),
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
    passwordIterations: hashed.passwordIterations,
    updatedBy: actor.id,
  });
  await auditService.log({
    eventType: AUDIT_EVENTS.USER_PASSWORD_RESET,
    entityType: "User",
    entityId: Number(userId),
    companyId: actor.companyId ?? null,
    performedBy: actor.id,
    newValue: { revokedSessions: result.revokedSessions },
    ipAddress: req.ip,
    userAgent: (req.get("user-agent") || "").slice(0, 500),
  });
  return result;
}

function updatedMessage(entityLabel, passwordChanged) {
  return passwordChanged
    ? `${entityLabel} updated. Password changed and all their sessions were signed out.`
    : `${entityLabel} updated.`;
}

module.exports = {
  readNewPassword, resetPassword, updatedMessage, PASSWORD_RULE,
};
