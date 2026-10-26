const { ROLES } = require("../constants/roles");
const adminUsers = require("../repositories/adminUser.repository");
const passwordService = require("../services/password.service");
const passwordReset = require("../services/passwordReset.service");
const { resolveCompanyId, toId } = require("../services/tenantScope");
const logger = require("../utils/logger");

const { EMPLOYEE } = adminUsers.KINDS;
const ASSIGN_FORBIDDEN = {
  success: false,
  message: "You are not allowed to assign this role or company.",
};
const NOT_FOUND = { success: false, message: "Employee not found." };
// users.company_id is NOT NULL, so a SUPER_ADMIN must pick a company for a new account.
const COMPANY_REQUIRED = { success: false, message: "Company is required." };
const DB_ERROR = { success: false, message: "Database error." };
const PASSWORD_RULE = `Password must be at least ${passwordService.MIN_PASSWORD_LENGTH} `
  + "characters.";

// GET /api/v1/employees
async function getAll(req, res) {
  try {
    return res.json({ success: true, data: await adminUsers.list(EMPLOYEE, req.user) });
  } catch (err) {
    logger.error({ err }, "employees getAll error");
    return res.status(500).json(DB_ERROR);
  }
}

// GET /api/v1/employees/:id
async function getById(req, res) {
  try {
    const row = await adminUsers.findById(EMPLOYEE, req.user, req.params.id);
    if (!row) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: row });
  } catch (err) {
    logger.error({ err }, "employees getById error");
    return res.status(500).json(DB_ERROR);
  }
}

// New passwords are stored as Argon2id. The username is the email's local part.
async function insertEmployee(body, companyId, actor) {
  const roleId = await adminUsers.roleIdByCode(ROLES.EMPLOYEE);
  if (roleId === null) {
    throw new Error(`Role ${ROLES.EMPLOYEE} is missing from the roles table.`);
  }
  const hashed = await passwordService.hashPassword(body.password);
  return adminUsers.insert({
    ...hashed,
    companyId,
    roleId,
    managerId: body.managerId,
    username: body.email.split("@")[0],
    email: body.email,
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    displayName: body.displayName,
    phoneNumber: body.phoneNumber,
    createdBy: actor.id,
  });
}

// POST /api/v1/employees
async function create(req, res) {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required." });
  if (!passwordService.isAcceptablePassword(password)) {
    return res.status(400).json({ success: false, message: PASSWORD_RULE });
  }
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);
  if (company.companyId === null) return res.status(400).json(COMPANY_REQUIRED);

  try {
    if (await adminUsers.emailInUse(email)) {
      return res.status(409).json({ success: false, message: "Email already in use." });
    }
    const id = await insertEmployee(req.body, company.companyId, req.user);
    return res.status(201).json({ success: true, message: "Employee created.", id });
  } catch (err) {
    logger.error({ err }, "employees create error");
    return res.status(500).json(DB_ERROR);
  }
}

function updateValues(body, companyId) {
  return {
    firstName: body.firstName,
    middleName: body.middleName,
    lastName: body.lastName,
    displayName: body.displayName,
    email: body.email,
    phoneNumber: body.phoneNumber,
    companyId,
    managerId: toId(body.managerId),
    isActive: body.isActive,
  };
}

// PUT /api/v1/employees/:id
async function update(req, res) {
  const company = resolveCompanyId(req.user, req.body.companyId);
  if (!company.allowed) return res.status(403).json(ASSIGN_FORBIDDEN);
  const newPassword = passwordReset.readNewPassword(req.body);
  if (newPassword.error) {
    return res.status(400).json({ success: false, message: newPassword.error });
  }
  const { id } = req.params;
  try {
    const values = updateValues(req.body, company.companyId);
    if (!(await adminUsers.update(EMPLOYEE, req.user, id, values))) {
      return res.status(404).json(NOT_FOUND);
    }
    if (newPassword.password) {
      await passwordReset.resetPassword(req.user, id, newPassword.password, req);
    }
    const message = passwordReset.updatedMessage("Employee", Boolean(newPassword.password));
    return res.json({ success: true, message });
  } catch (err) {
    logger.error({ err }, "employees update error");
    return res.status(500).json(DB_ERROR);
  }
}

// PATCH /api/v1/employees/:id/status
async function toggleStatus(req, res) {
  const { isActive } = req.body;
  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: "isActive is required." });
  }
  try {
    if (!(await adminUsers.setActive(EMPLOYEE, req.user, req.params.id, Boolean(isActive)))) {
      return res.status(404).json(NOT_FOUND);
    }
    return res.json({
      success: true,
      message: isActive ? "Employee activated." : "Employee deactivated.",
    });
  } catch (err) {
    logger.error({ err }, "employees toggleStatus error");
    return res.status(500).json(DB_ERROR);
  }
}

// DELETE /api/v1/employees/:id (soft delete)
async function remove(req, res) {
  if (Number(req.params.id) === Number(req.user.id)) {
    return res.status(403).json({ success: false, message: "You cannot delete your own account." });
  }
  try {
    if (!(await adminUsers.softDelete(EMPLOYEE, req.user, req.params.id))) {
      return res.status(404).json(NOT_FOUND);
    }
    return res.json({ success: true, message: "Employee deleted." });
  } catch (err) {
    logger.error({ err }, "employees remove error");
    return res.status(500).json(DB_ERROR);
  }
}

// GET /api/v1/employees/managers-list  (for dropdown)
async function getManagersList(req, res) {
  try {
    return res.json({ success: true, data: await adminUsers.listManagerOptions(req.user) });
  } catch (err) {
    logger.error({ err }, "getManagersList error");
    return res.status(500).json(DB_ERROR);
  }
}

module.exports = {
  getAll, getById, create, update, toggleStatus, remove, getManagersList,
};
