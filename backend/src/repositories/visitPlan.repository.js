const db = require("../config/db");

const USER_NAME = "COALESCE(NULLIF(u.display_name, ''), u.first_name || ' ' || u.last_name)";

// The company's time zone and today's date in it ("YYYY-MM-DD").
async function companyClock(companyId) {
  const { rows } = await db.query(`
    SELECT time_zone,
           to_char((now() AT TIME ZONE time_zone)::date, 'YYYY-MM-DD') AS today
    FROM companies
    WHERE id = @companyId AND NOT is_deleted
  `, { companyId });
  return rows[0] || null;
}

async function activeActivityTypes(companyId) {
  const { rows } = await db.query(`
    SELECT id, name FROM activity_types
    WHERE company_id = @companyId AND is_active AND NOT is_deleted
    ORDER BY id
  `, { companyId });
  return rows;
}

// Every active rep-account assignment with a visit target, and how many of that rep's visits
// to that account (any source, not cancelled) are already due inside the month.
async function coverageNeeds(q, {
  companyId, timeZone, start, end,
}) {
  const { rows } = await q.query(`
    SELECT aa.account_id, a.name AS account_name, aa.user_id, ${USER_NAME} AS user_name,
           aa.visits_per_month,
           (SELECT count(*)::int FROM activities x
             WHERE x.company_id = aa.company_id AND x.account_id = aa.account_id
               AND x.assigned_to = aa.user_id AND NOT x.is_deleted AND x.status <> 'Cancelled'
               AND (x.due_at AT TIME ZONE @timeZone)::date BETWEEN @start::date AND @end::date
           ) AS existing
    FROM account_assignments aa
    JOIN accounts a ON a.company_id = aa.company_id AND a.id = aa.account_id
      AND a.is_active AND NOT a.is_deleted
    JOIN users u ON u.company_id = aa.company_id AND u.id = aa.user_id
      AND u.is_active AND NOT u.is_deleted
    WHERE aa.company_id = @companyId AND NOT aa.is_deleted AND aa.visits_per_month IS NOT NULL
    ORDER BY user_name, account_name, aa.account_id
  `, {
    companyId, timeZone, start, end,
  });
  return rows;
}

// Serialises "Generate plan" per company and month, so two clicks can never both insert.
async function lockPlan(tx, companyId, planMonth) {
  await tx.query(
    "SELECT pg_advisory_xact_lock(hashtext("
      + "'visit-plan:' || @companyId::text || ':' || @planMonth))",
    { companyId, planMonth },
  );
}

// Inserts all planned visits in one statement. Due time is 18:00 local on the planned day.
async function insertPlanned(tx, plan) {
  const { rows } = await tx.query(`
    INSERT INTO activities
      (company_id, activity_type_id, account_id, assigned_to, assigned_by, title, status,
       priority, due_at, source, plan_month, created_by, updated_by)
    SELECT @companyId, @activityTypeId, r.account_id, r.assigned_to, @userId, r.title, 'Pending',
           'Medium', (r.due_date + time '18:00') AT TIME ZONE @timeZone, 'PLAN',
           @planMonth::date, @userId, @userId
    FROM unnest(@accountIds::int[], @assignedTos::int[], @dueDates::date[], @titles::text[])
      AS r(account_id, assigned_to, due_date, title)
    RETURNING id
  `, plan);
  return rows.map((row) => row.id);
}

// Pending / in-progress visits whose due day (in each company's zone) has ended -> Missed.
async function markMissed(companyId) {
  const { rows } = await db.query(`
    UPDATE activities x
    SET status = 'Missed', updated_at = now(), updated_by = NULL
    FROM companies c
    WHERE c.id = x.company_id AND NOT x.is_deleted AND x.due_at IS NOT NULL
      AND x.status IN ('Pending', 'InProgress')
      AND (x.due_at AT TIME ZONE c.time_zone)::date < (now() AT TIME ZONE c.time_zone)::date
      AND (@companyId::int IS NULL OR x.company_id = @companyId::int)
    RETURNING x.id, x.company_id
  `, { companyId });
  return rows;
}

module.exports = {
  companyClock, activeActivityTypes, coverageNeeds, lockPlan, insertPlanned, markMissed,
};
