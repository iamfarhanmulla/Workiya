const db = require("../config/db");

async function listByCompany(companyId) {
  const { rows } = await db.query(
    `SELECT term_key, label
     FROM company_terminology
     WHERE company_id = @companyId AND NOT is_deleted`,
    { companyId },
  );
  return rows;
}

// Saves every label in one statement, so a failure leaves the old labels in place. The
// conflict target is the partial unique index on (company_id, term_key) of live rows.
async function upsertLabels(companyId, labels, userId) {
  const entries = Object.entries(labels);
  if (entries.length === 0) {
    return;
  }
  await db.query(
    `INSERT INTO company_terminology (company_id, term_key, label, created_by, updated_by)
     SELECT @companyId, t.term_key, t.label, @userId, @userId
     FROM unnest(@termKeys::varchar[], @labels::varchar[]) AS t (term_key, label)
     ON CONFLICT (company_id, term_key) WHERE NOT is_deleted
     DO UPDATE SET label = EXCLUDED.label, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    {
      companyId,
      userId,
      termKeys: entries.map(([termKey]) => termKey),
      labels: entries.map(([, label]) => label),
    },
  );
}

module.exports = { listByCompany, upsertLabels };
