const db = require("../config/db");

const USER_NAME = "COALESCE(NULLIF(u.display_name, ''), u.first_name || ' ' || u.last_name)";
// Local due date of an activity in the company's time zone.
const DUE_DAY = "(x.due_at AT TIME ZONE @timeZone)::date";
const IN_MONTH = `${DUE_DAY} BETWEEN @start::date AND @end::date`;
const ONLY_REP = "(@userId::int IS NULL OR x.assigned_to = @userId::int)";

// Visit counts per rep for activities due in the month.
async function statusByRep(params) {
  const { rows } = await db.query(`
    SELECT x.assigned_to AS user_id, ${USER_NAME} AS user_name,
           count(*) FILTER (WHERE x.status <> 'Cancelled')::int AS scheduled,
           count(*) FILTER (WHERE x.status = 'Completed')::int AS completed,
           count(*) FILTER (WHERE x.status = 'Missed')::int AS missed,
           count(*) FILTER (WHERE x.status IN ('Pending', 'InProgress'))::int AS open,
           count(*) FILTER (WHERE x.status = 'Cancelled')::int AS cancelled,
           count(*) FILTER (WHERE x.status = 'Completed' AND EXISTS (
             SELECT 1 FROM submissions s
             WHERE s.company_id = x.company_id AND s.activity_id = x.id
               AND NOT s.is_deleted AND s.review_status = 'Approved'))::int AS approved
    FROM activities x
    JOIN users u ON u.id = x.assigned_to
    WHERE x.company_id = @companyId AND NOT x.is_deleted AND x.due_at IS NOT NULL
      AND ${IN_MONTH} AND ${ONLY_REP}
    GROUP BY x.assigned_to, user_name
  `, params);
  return rows;
}

// Monthly visit targets per rep from their account assignments.
async function targetsByRep(params) {
  const { rows } = await db.query(`
    SELECT aa.user_id, ${USER_NAME} AS user_name,
           COALESCE(sum(aa.visits_per_month), 0)::int AS target,
           count(*)::int AS accounts
    FROM account_assignments aa
    JOIN accounts a ON a.company_id = aa.company_id AND a.id = aa.account_id
      AND a.is_active AND NOT a.is_deleted
    JOIN users u ON u.company_id = aa.company_id AND u.id = aa.user_id AND NOT u.is_deleted
    WHERE aa.company_id = @companyId AND NOT aa.is_deleted
      AND (@userId::int IS NULL OR aa.user_id = @userId::int)
    GROUP BY aa.user_id, user_name
  `, params);
  return rows;
}

// Assigned accounts with no completed visit due in the month, with the last visit ever.
async function notVisited(params) {
  const { rows } = await db.query(`
    SELECT aa.account_id, a.name AS account_name, aa.user_id, ${USER_NAME} AS user_name,
           aa.visits_per_month,
           (SELECT max(x.completed_at) FROM activities x
             WHERE x.company_id = aa.company_id AND x.account_id = aa.account_id
               AND x.assigned_to = aa.user_id AND x.status = 'Completed' AND NOT x.is_deleted
           ) AS last_visit_at
    FROM account_assignments aa
    JOIN accounts a ON a.company_id = aa.company_id AND a.id = aa.account_id
      AND a.is_active AND NOT a.is_deleted
    JOIN users u ON u.company_id = aa.company_id AND u.id = aa.user_id
      AND u.is_active AND NOT u.is_deleted
    WHERE aa.company_id = @companyId AND NOT aa.is_deleted
      AND (@userId::int IS NULL OR aa.user_id = @userId::int)
      AND NOT EXISTS (
        SELECT 1 FROM activities x
        WHERE x.company_id = aa.company_id AND x.account_id = aa.account_id
          AND x.assigned_to = aa.user_id AND x.status = 'Completed' AND NOT x.is_deleted
          AND x.due_at IS NOT NULL AND ${IN_MONTH})
    ORDER BY user_name, account_name
    LIMIT 500
  `, params);
  return rows;
}

// Completed and missed visits per week (Monday start) for the last N weeks up to today.
async function weeklyTrend(params) {
  const { rows } = await db.query(`
    SELECT to_char(date_trunc('week', ${DUE_DAY}), 'YYYY-MM-DD') AS week_start,
           count(*) FILTER (WHERE x.status = 'Completed')::int AS completed,
           count(*) FILTER (WHERE x.status = 'Missed')::int AS missed
    FROM activities x
    WHERE x.company_id = @companyId AND NOT x.is_deleted AND x.due_at IS NOT NULL
      AND ${DUE_DAY} >= @from::date AND ${DUE_DAY} <= @today::date AND ${ONLY_REP}
    GROUP BY 1
    ORDER BY 1
  `, params);
  return rows;
}

module.exports = {
  statusByRep, targetsByRep, notVisited, weeklyTrend,
};
