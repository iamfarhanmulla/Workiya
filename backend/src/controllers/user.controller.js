const { ROLES } = require("../constants/roles");
const adminUsers = require("../repositories/adminUser.repository");
const companies = require("../repositories/company.repository");
const passwordService = require("../services/password.service");
const passwordReset = require("../services/passwordReset.service");
const { toId, isSuperAdmin, resolveCompanyId } = require("../services/tenantScope");
const logger = require("../utils/logger");

const { USER } = adminUsers.KINDS;
const ASSIGN_FORBIDDEN = {
  success: false,
  message: "You are not allowed to assign this role or company.",
};
const NOT_FOUND = { success: false, message: "User not found." };
// users.company_id is NOT NULL, so a SUPER_ADMIN must pick a company for a new account.
const COMPANY_REQUIRED = { success: false, message: "Company is required." };
const DB_ERROR = { success: false, message: "Database error." };
const PASSWORD_RULE = `Password must be at least ${passwordService.MIN_PASSWORD_LENGTH} `
  + "characters.";

// Only SUPER_ADMIN may grant the SUPER_ADMIN role.
async function canAssignRole(user, roleId) {
  if (isSuperAdmin(user) || toId(roleId) === null) return true;
  return (await adminUsers.roleCodeOf(roleId)) !== ROLES.SUPER_ADMIN;
}

// GET /api/v1/users
async function getAll(req, res) {
  try {
    return res.json({ success: true, data: await adminUsers.list(USER, req.user) });
  } catch (err) {
    logger.error({ err }, "getAll users error");
    return res.status(500).json(DB_ERROR);
  }
}

// GET /api/v1/users/:id
async function getById(req, res) {
  try {
    const row = await adminUsers.findById(USER, req.user, req.params.id);
    if (!row) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: row });
  } catch (err) {
    logger.error({ err }, "getById user error");
    return res.status(500).json(DB_ERROR);
  }
}

// New passwords are stored as Argon2id.
async function insertUser(body, companyId, actor) {
  const hashed = await passwordService.hashPassword(body.password);
  return adminUsers.insert({
    ...hashed,
    companyId,
    roleId: body.roleId,
    managerId: body.managerId,
    username: body.username,
    email: body.email,
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    displayName: body.displayName,
    phoneNumber: body.phoneNumber,
    createdBy: actor.id,
  });
}

// POST /api/v1/users
async function create(req, res) {
  const { email, password, roleId } = req.body;
  if (!email || !password || !roleId) {
    return res.status(400).json({
      success: false, message: "Email, password and roleId are required.",
    });
  }
  if (!passwordService.isAcceptablePassword(password)) {
    return res.status(400).json({ success: false, message: PASSWORD_RULE });
  }
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);
  if (company.companyId === null) return res.status(400).json(COMPANY_REQUIRED);

  try {
    if (!(await canAssignRole(req.user, roleId))) {
      return res.status(403).json(ASSIGN_FORBIDDEN);
    }
    if (await adminUsers.emailInUse(email)) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }
    const id = await insertUser(req.body, company.companyId, req.user);
    return res.status(201).json({ success: true, message: "User created.", id });
  } catch (err) {
    logger.error({ err }, "create user error");
    return res.status(500).json(DB_ERROR);
  }
}

function updateValues(body, companyId) {
  return {
    companyId,
    roleId: toId(body.roleId),
    managerId: toId(body.managerId),
    username: body.username,
    email: body.email,
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    displayName: body.displayName,
    phoneNumber: body.phoneNumber,
    isActive: body.isActive,
  };
}

// PUT /api/v1/users/:id
async function update(req, res) {
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);
  const newPassword = passwordReset.readNewPassword(req.body);
  if (newPassword.error) {
    return res.status(400).json({ success: false, message: newPassword.error });
  }
  const { id } = req.params;
  try {
    if (!(await adminUsers.existsInScope(USER, req.user, id))) {
      return res.status(404).json(NOT_FOUND);
    }
    if (!(await canAssignRole(req.user, req.body.roleId))) {
      return res.status(403).json(ASSIGN_FORBIDDEN);
    }
    const values = updateValues(req.body, company.companyId);
    if (!(await adminUsers.update(USER, req.user, id, values))) {
      return res.status(404).json(NOT_FOUND);
    }
    if (newPassword.password) {
      await passwordReset.resetPassword(req.user, id, newPassword.password, req);
    }
    const message = passwordReset.updatedMessage("User", Boolean(newPassword.password));
    return res.json({ success: true, message });
  } catch (err) {
    logger.error({ err }, "update user error");
    return res.status(500).json(DB_ERROR);
  }
}

// DELETE /api/v1/users/:id  (soft delete)
async function remove(req, res) {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(403).json({ success: false, message: "You cannot delete your own account." });
  }
  try {
    if (!(await adminUsers.softDelete(USER, req.user, req.params.id))) {
      return res.status(404).json(NOT_FOUND);
    }
    return res.json({ success: true, message: "User deleted." });
  } catch (err) {
    logger.error({ err }, "delete user error");
    return res.status(500).json(DB_ERROR);
  }
}

// GET /api/v1/users/roles
async function getRoles(req, res) {
  try {
    return res.json({ success: true, data: await adminUsers.listRoles() });
  } catch (err) {
    logger.error({ err }, "getRoles error");
    return res.status(500).json(DB_ERROR);
  }
}

// GET /api/v1/users/companies  (non-super-admins only see their own company)
async function getCompanies(req, res) {
  try {
    return res.json({ success: true, data: await companies.listOptions(req.user) });
  } catch (err) {
    logger.error({ err }, "getCompanies error");
    return res.status(500).json(DB_ERROR);
  }
}

module.exports = {
  getAll, getById, create, update, remove, getRoles, getCompanies,
};
