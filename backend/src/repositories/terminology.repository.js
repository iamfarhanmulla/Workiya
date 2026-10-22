const { connectDb, sql } = require("../config/db");
const logger = require("../utils/logger");

async function listByCompany(companyId) {
  const pool = await connectDb();
  const result = await pool
    .request()
    .input("companyId", sql.Int, companyId)
    .query(`
      SELECT TermKey, Label
      FROM CompanyTerminology
      WHERE CompanyId = @companyId AND IsDeleted = 0
    `);
  return result.recordset;
}

function upsertOne(transaction, companyId, termKey, label, userId) {
  return transaction
    .request()
    .input("companyId", sql.Int, companyId)
    .input("termKey", sql.NVarChar(50), termKey)
    .input("label", sql.NVarChar(100), label)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE CompanyTerminology SET
        Label = @label, UpdatedAtUtc = GETUTCDATE(), UpdatedBy = @userId
      WHERE CompanyId = @companyId AND TermKey = @termKey AND IsDeleted = 0;
      IF @@ROWCOUNT = 0
        INSERT INTO CompanyTerminology
          (CompanyId, TermKey, Label, CreatedAtUtc, CreatedBy, UpdatedAtUtc, UpdatedBy, IsDeleted)
        VALUES (@companyId, @termKey, @label, GETUTCDATE(), @userId, GETUTCDATE(), @userId, 0);
    `);
}

// Saves every label in one transaction, so a failure leaves the old labels in place.
async function upsertLabels(companyId, labels, userId) {
  const pool = await connectDb();
  const transaction = pool.transaction();
  await transaction.begin();
  try {
    // Sequential on purpose: one mssql transaction runs one request at a time.
    // eslint-disable-next-line no-restricted-syntax
    for (const [termKey, label] of Object.entries(labels)) {
      // eslint-disable-next-line no-await-in-loop
      await upsertOne(transaction, companyId, termKey, label, userId);
    }
    await transaction.commit();
  } catch (err) {
    // A rollback failure (e.g. SQL Server already aborted the transaction) must not hide
    // the error that caused it.
    try {
      await transaction.rollback();
    } catch (rollbackErr) {
      logger.warn({ err: rollbackErr }, "Transaction rollback failed");
    }
    throw err;
  }
}

module.exports = { listByCompany, upsertLabels };
