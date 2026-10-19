const { connectDb, sql } = require("../config/db");
const { ROLES } = require("../constants/roles");
const { isSuperAdmin, toId, companyFilter } = require("../services/tenantScope");
const logger = require("../utils/logger");

const NOT_FOUND = { success: false, message: "Task not found." };
const FOREIGN_REFERENCE = {
  success: false,
  message: "Doctor and assignee must belong to your company.",
};

const BASE_SELECT = `
  SELECT
    t.Id, t.CompanyId, t.DoctorId, t.AssignedTo, t.AssignedBy,
    t.Title, t.Description, t.Status, t.Priority,
    t.DueDate, t.CompletedAt, t.CreatedAtUtc, t.UpdatedAtUtc,
    d.Name          AS DoctorName,
    d.Specialization AS DoctorSpec,
    d.HospitalName  AS DoctorHospital,
    d.City          AS DoctorCity,
    emp.FirstName + ' ' + emp.LastName AS AssigneeName,
    mgr.FirstName + ' ' + mgr.LastName AS AssignedByName,
    c.Name          AS CompanyName
  FROM Tasks t
  LEFT JOIN Doctors   d   ON d.Id  = t.DoctorId
  LEFT JOIN Users     emp ON emp.Id = t.AssignedTo
  LEFT JOIN Users     mgr ON mgr.Id = t.AssignedBy
  LEFT JOIN Companies c   ON c.Id  = t.CompanyId
`;

// A task may only point at a doctor and an assignee from the caller's own company.
async function referencesInCompany(pool, user, doctorId, assignedTo) {
  if (isSuperAdmin(user)) return true;
  const result = await pool.request()
    .input("doctorId", sql.Int, toId(doctorId))
    .input("assignedTo", sql.Int, toId(assignedTo))
    .input("companyId", sql.Int, toId(user.companyId))
    .query(`
      SELECT
        CASE WHEN @doctorId IS NULL OR EXISTS (
          SELECT 1 FROM Doctors WHERE Id = @doctorId AND CompanyId = @companyId AND IsDeleted = 0
        ) THEN 1 ELSE 0 END AS DoctorOk,
        CASE WHEN @assignedTo IS NULL OR EXISTS (
          SELECT 1 FROM Users WHERE Id = @assignedTo AND CompanyId = @companyId AND IsDeleted = 0
        ) THEN 1 ELSE 0 END AS AssigneeOk
    `);
  const row = result.recordset[0];
  return Boolean(row && row.DoctorOk && row.AssigneeOk);
}

// GET /api/v1/tasks
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request();
    const scope = companyFilter(request, req.user, "t.CompanyId");
    const result = await request.query(
      `${BASE_SELECT} WHERE t.IsDeleted = 0 AND ${scope} ORDER BY t.CreatedAtUtc DESC`,
    );
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error({ err }, "tasks getAll error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/v1/tasks/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = companyFilter(request, req.user, "t.CompanyId");
    const result = await request.query(
      `${BASE_SELECT} WHERE t.Id = @id AND t.IsDeleted = 0 AND ${scope}`,
    );
    if (!result.recordset.length) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    logger.error({ err }, "tasks getById error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/v1/tasks
async function create(req, res) {
  const {
    doctorId, assignedTo, title, description, priority, dueDate,
  } = req.body;

  if (!title) return res.status(400).json({ success: false, message: "Title is required." });
  if (!doctorId) return res.status(400).json({ success: false, message: "Doctor is required." });
  if (!assignedTo) {
    return res.status(400).json({ success: false, message: "Assignee is required." });
  }

  try {
    const pool = await connectDb();
    if (!(await referencesInCompany(pool, req.user, doctorId, assignedTo))) {
      return res.status(400).json(FOREIGN_REFERENCE);
    }
    const result = await pool.request()
      .input("companyId", sql.Int, req.user.companyId ?? null)
      .input("doctorId", sql.Int, doctorId)
      .input("assignedTo", sql.Int, assignedTo)
      .input("assignedBy", sql.Int, req.user.id)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description || null)
      .input("priority", sql.NVarChar, priority || "Medium")
      .input("dueDate", sql.DateTimeOffset, dueDate || null)
      .query(`
        INSERT INTO Tasks
          (CompanyId, DoctorId, AssignedTo, AssignedBy,
           Title, Description, Status, Priority, DueDate, IsDeleted, CreatedAtUtc)
        OUTPUT INSERTED.Id
        VALUES
          (@companyId, @doctorId, @assignedTo, @assignedBy,
           @title, @description, 'Pending', @priority, @dueDate, 0, SYSDATETIMEOFFSET())
      `);
    return res.status(201).json({
      success: true, message: "Task created.", id: result.recordset[0].Id,
    });
  } catch (err) {
    logger.error({ err }, "tasks create error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/v1/tasks/:id
async function update(req, res) {
  const {
    doctorId, assignedTo, title, description, priority, dueDate,
  } = req.body;

  try {
    const pool = await connectDb();
    if (!(await referencesInCompany(pool, req.user, doctorId, assignedTo))) {
      return res.status(400).json(FOREIGN_REFERENCE);
    }
    const request = pool.request()
      .input("id", sql.Int, req.params.id)
      .input("doctorId", sql.Int, doctorId ?? null)
      .input("assignedTo", sql.Int, assignedTo ?? null)
      .input("title", sql.NVarChar, title ?? null)
      .input("description", sql.NVarChar, description ?? null)
      .input("priority", sql.NVarChar, priority ?? null)
      .input("dueDate", sql.DateTimeOffset, dueDate || null);
    const scope = companyFilter(request, req.user, "CompanyId");
    const result = await request.query(`
      UPDATE Tasks SET
        DoctorId    = @doctorId,
        AssignedTo  = @assignedTo,
        Title       = @title,
        Description = @description,
        Priority    = @priority,
        DueDate     = @dueDate,
        UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "Task updated." });
  } catch (err) {
    logger.error({ err }, "tasks update error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// Employees may only move tasks assigned to them; everyone else is limited to their company.
function statusScope(request, user) {
  const company = companyFilter(request, user, "CompanyId");
  if (user.roleCode !== ROLES.EMPLOYEE) return company;
  request.input("userId", sql.Int, user.id);
  return `${company} AND AssignedTo = @userId`;
}

// PATCH /api/v1/tasks/:id/status
async function updateStatus(req, res) {
  const { status } = req.body;
  const allowed = ["Pending", "InProgress", "Completed", "Cancelled"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }

  try {
    const pool = await connectDb();
    const request = pool.request()
      .input("id", sql.Int, req.params.id)
      .input("status", sql.NVarChar, status);
    const scope = statusScope(request, req.user);
    const result = await request.query(`
      UPDATE Tasks SET
        Status       = @status,
        CompletedAt  = CASE WHEN @status = 'Completed' THEN SYSDATETIMEOFFSET()
                            ELSE CompletedAt END,
        UpdatedAtUtc = SYSDATETIMEOFFSET()
      WHERE Id = @id AND IsDeleted = 0 AND ${scope}
    `);
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: `Task moved to ${status}.` });
  } catch (err) {
    logger.error({ err }, "tasks updateStatus error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/v1/tasks/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    const request = pool.request().input("id", sql.Int, req.params.id);
    const scope = companyFilter(request, req.user, "CompanyId");
    const result = await request.query(
      "UPDATE Tasks SET IsDeleted = 1, UpdatedAtUtc = SYSDATETIMEOFFSET() "
      + `WHERE Id = @id AND IsDeleted = 0 AND ${scope}`,
    );
    if (result.rowsAffected[0] === 0) return res.status(404).json(NOT_FOUND);
    return res.json({ success: true, message: "Task deleted." });
  } catch (err) {
    logger.error({ err }, "tasks remove error");
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = {
  getAll, getById, create, update, updateStatus, remove,
};
