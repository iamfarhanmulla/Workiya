const { connectDb, sql } = require("../config/db");

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

// GET /api/tasks
async function getAll(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request().query(
      BASE_SELECT + " WHERE t.IsDeleted = 0 ORDER BY t.CreatedAtUtc DESC"
    );
    return res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error("tasks getAll error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// GET /api/tasks/:id
async function getById(req, res) {
  try {
    const pool = await connectDb();
    const result = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query(BASE_SELECT + " WHERE t.Id = @id AND t.IsDeleted = 0");
    if (!result.recordset.length)
      return res.status(404).json({ success: false, message: "Task not found." });
    return res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    console.error("tasks getById error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// POST /api/tasks
async function create(req, res) {
  const { companyId, doctorId, assignedTo, assignedBy, title, description, priority, dueDate } = req.body;

  if (!title)      return res.status(400).json({ success: false, message: "Title is required." });
  if (!doctorId)   return res.status(400).json({ success: false, message: "Doctor is required." });
  if (!assignedTo) return res.status(400).json({ success: false, message: "Assignee is required." });
  if (!assignedBy) return res.status(400).json({ success: false, message: "AssignedBy is required." });

  try {
    const pool = await connectDb();
    const result = await pool.request()
      .input("companyId",   sql.Int,           companyId   || null)
      .input("doctorId",    sql.Int,           doctorId)
      .input("assignedTo",  sql.Int,           assignedTo)
      .input("assignedBy",  sql.Int,           assignedBy)
      .input("title",       sql.NVarChar,      title)
      .input("description", sql.NVarChar,      description || null)
      .input("priority",    sql.NVarChar,      priority    || "Medium")
      .input("dueDate",     sql.DateTimeOffset, dueDate    || null)
      .query(`
        INSERT INTO Tasks
          (CompanyId, DoctorId, AssignedTo, AssignedBy,
           Title, Description, Status, Priority, DueDate, IsDeleted, CreatedAtUtc)
        OUTPUT INSERTED.Id
        VALUES
          (@companyId, @doctorId, @assignedTo, @assignedBy,
           @title, @description, 'Pending', @priority, @dueDate, 0, SYSDATETIMEOFFSET())
      `);
    return res.status(201).json({ success: true, message: "Task created.", id: result.recordset[0].Id });
  } catch (err) {
    console.error("tasks create error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PUT /api/tasks/:id
async function update(req, res) {
  const { doctorId, assignedTo, title, description, priority, dueDate } = req.body;

  try {
    const pool = await connectDb();
    const exists = await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("SELECT Id FROM Tasks WHERE Id = @id AND IsDeleted = 0");
    if (!exists.recordset.length)
      return res.status(404).json({ success: false, message: "Task not found." });

    await pool.request()
      .input("id",          sql.Int,           req.params.id)
      .input("doctorId",    sql.Int,           doctorId    ?? null)
      .input("assignedTo",  sql.Int,           assignedTo  ?? null)
      .input("title",       sql.NVarChar,      title       ?? null)
      .input("description", sql.NVarChar,      description ?? null)
      .input("priority",    sql.NVarChar,      priority    ?? null)
      .input("dueDate",     sql.DateTimeOffset, dueDate    || null)
      .query(`
        UPDATE Tasks SET
          DoctorId    = @doctorId,
          AssignedTo  = @assignedTo,
          Title       = @title,
          Description = @description,
          Priority    = @priority,
          DueDate     = @dueDate,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id
      `);
    return res.json({ success: true, message: "Task updated." });
  } catch (err) {
    console.error("tasks update error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// PATCH /api/tasks/:id/status
async function updateStatus(req, res) {
  const { status } = req.body;
  const allowed = ["Pending", "InProgress", "Completed", "Cancelled"];
  if (!allowed.includes(status))
    return res.status(400).json({ success: false, message: "Invalid status." });

  try {
    const pool = await connectDb();
    await pool.request()
      .input("id",     sql.Int,      req.params.id)
      .input("status", sql.NVarChar, status)
      .query(`
        UPDATE Tasks SET
          Status       = @status,
          CompletedAt  = CASE WHEN @status = 'Completed' THEN SYSDATETIMEOFFSET() ELSE CompletedAt END,
          UpdatedAtUtc = SYSDATETIMEOFFSET()
        WHERE Id = @id AND IsDeleted = 0
      `);
    return res.json({ success: true, message: `Task moved to ${status}.` });
  } catch (err) {
    console.error("tasks updateStatus error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

// DELETE /api/tasks/:id  (soft delete)
async function remove(req, res) {
  try {
    const pool = await connectDb();
    await pool.request()
      .input("id", sql.Int, req.params.id)
      .query("UPDATE Tasks SET IsDeleted = 1, UpdatedAtUtc = SYSDATETIMEOFFSET() WHERE Id = @id");
    return res.json({ success: true, message: "Task deleted." });
  } catch (err) {
    console.error("tasks remove error:", err.message);
    return res.status(500).json({ success: false, message: "Database error." });
  }
}

module.exports = { getAll, getById, create, update, updateStatus, remove };
