const companies = require("../repositories/company.repository");
const { isUniqueViolation } = require("../config/dbErrors");
const logger = require("../utils/logger");

const NOT_FOUND = { success: false, message: "Company not found." };
const DB_ERROR = { success: false, message: "Database error." };
const DUPLICATE_KEY = { success: false, message: "A company with this key already exists." };

function deriveKey(key, name) {
  return (key || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// GET /api/v1/companies
async function getAll(req, res) {
  try {
    return res.json({ success: true, data: await companies.list() });
  } catch (err) {
    logger.error({ err }, "companies getAll error");
    return res.status(500).json(DB_ERROR);
  }
}

// GET /api/v1/companies/:id
async function getById(req, res) {
  try {
    const row = await companies.findById(req.params.id);
    if (!row) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: row });
  } catch (err) {
    logger.error({ err }, "companies getById error");
    return res.status(500).json(DB_ERROR);
  }
}

function insertFields(body, key, actor) {
  return {
    name: body.name,
    key,
    logoUrl: body.logoUrl || null,
    contactEmail: body.contactEmail || null,
    contactPhone: body.contactPhone || null,
    address: body.address || null,
    city: body.city || null,
    country: body.country || null,
    plan: body.plan || "STARTUP",
    actorId: actor.id,
  };
}

// POST /api/v1/companies
async function create(req, res) {
  const { name, key } = req.body;
  if (!name) return res.status(400).json({ success: false, message: "Company name is required." });
  const derivedKey = deriveKey(key, name);

  try {
    if (await companies.keyInUse(derivedKey)) {
      return res.status(409).json(DUPLICATE_KEY);
    }
    const id = await companies.insert(insertFields(req.body, derivedKey, req.user));
    return res.status(201).json({ success: true, message: "Company created.", id });
  } catch (err) {
    // The key is unique across all rows, deleted ones included, and across concurrent creates.
    if (isUniqueViolation(err)) return res.status(409).json(DUPLICATE_KEY);
    logger.error({ err }, "companies create error");
    return res.status(500).json(DB_ERROR);
  }
}

function updateFields(body, actor) {
  return {
    name: body.name ?? null,
    key: body.key ?? null,
    logoUrl: body.logoUrl ?? null,
    contactEmail: body.contactEmail ?? null,
    contactPhone: body.contactPhone ?? null,
    address: body.address ?? null,
    city: body.city ?? null,
    country: body.country ?? null,
    plan: body.plan ?? null,
    isActive: body.isActive,
    actorId: actor.id,
  };
}

// PUT /api/v1/companies/:id
async function update(req, res) {
  try {
    if (!(await companies.exists(req.params.id))) {
      return res.status(404).json(NOT_FOUND);
    }
    await companies.update(req.params.id, updateFields(req.body, req.user));
    return res.json({ success: true, message: "Company updated." });
  } catch (err) {
    logger.error({ err }, "companies update error");
    return res.status(500).json(DB_ERROR);
  }
}

// PATCH /api/v1/companies/:id/status
async function toggleStatus(req, res) {
  const { isActive } = req.body;
  if (isActive === undefined) {
    return res.status(400).json({ success: false, message: "isActive is required." });
  }
  try {
    await companies.setActive(req.params.id, Boolean(isActive), req.user.id);
    return res.json({
      success: true,
      message: isActive ? "Company activated." : "Company deactivated.",
    });
  } catch (err) {
    logger.error({ err }, "companies toggleStatus error");
    return res.status(500).json(DB_ERROR);
  }
}

// DELETE /api/v1/companies/:id  (soft delete)
async function remove(req, res) {
  try {
    await companies.softDelete(req.params.id, req.user.id);
    return res.json({ success: true, message: "Company deleted." });
  } catch (err) {
    logger.error({ err }, "companies remove error");
    return res.status(500).json(DB_ERROR);
  }
}

module.exports = {
  getAll, getById, create, update, toggleStatus, remove,
};
