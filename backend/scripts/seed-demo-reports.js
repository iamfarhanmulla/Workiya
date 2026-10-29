const path = require("node:path");
const crypto = require("node:crypto");
const { ROLES } = require("../src/constants/roles");
const passwordService = require("../src/services/password.service");
const { buildDemoPlan } = require("./demoReportPlan");

// Fills companies with demo reps, doctors, assignments and visits (last month and this month)
// so Reports has something to show. Every demo user and doctor is tagged DEMO_DATA, and
// --remove deletes them together with every assignment, visit and report attached to them.
// Demo reps get a random password nobody knows, so they cannot sign in.
const DEFAULT_URL_ENV = "DATABASE_URL_DIRECT";
const DEFAULT_COMPANIES = [1, 2];
const MARK = "DEMO_DATA";
const USAGE = "Usage: node scripts/seed-demo-reports.js [--yes] [--remove] "
  + "[--companies 1,2] [--url-env <ENV_NAME>]\n";

function parseArgs(argv) {
  const args = argv.slice(2);
  const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const companies = valueOf("--companies");
  return {
    confirmed: args.includes("--yes"),
    remove: args.includes("--remove"),
    urlEnv: valueOf("--url-env") ?? DEFAULT_URL_ENV,
    companyIds: companies ? companies.split(",").map(Number) : DEFAULT_COMPANIES,
  };
}

// Company time zone and local date, the staff member who "assigns" the visits, the visit type
// and whether demo data is already there. Null when the company does not exist.
async function loadContext(db, companyId) {
  const { rows } = await db.query(`
    SELECT c.name, c.time_zone,
           to_char((now() AT TIME ZONE c.time_zone)::date, 'YYYY-MM-DD') AS today,
           (SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
             WHERE u.company_id = c.id AND NOT u.is_deleted AND u.is_active
               AND r.code IN (@manager, @admin)
             ORDER BY (r.code = @manager) DESC, u.id LIMIT 1) AS manager_id,
           (SELECT t.id FROM activity_types t
             WHERE t.company_id = c.id AND NOT t.is_deleted AND t.is_active
             ORDER BY t.id LIMIT 1) AS activity_type_id,
           (SELECT count(*) FROM users u
             WHERE u.company_id = c.id AND u.remarks = @mark AND NOT u.is_deleted) AS demo_users
    FROM companies c WHERE c.id = @companyId AND NOT c.is_deleted`, {
    companyId, manager: ROLES.MANAGER, admin: ROLES.ADMIN, mark: MARK,
  });
  return rows[0] || null;
}

// Runs fn over items one after another and collects the results (one connection, and later
// rows need the ids of earlier ones).
function inSequence(items, fn) {
  return items.reduce(
    async (previous, item, i) => [...(await previous), await fn(item, i)],
    Promise.resolve([]),
  );
}

async function insertReps(tx, companyId, ctx, reps, hashed) {
  return inSequence(reps, async (rep) => {
    const { rows } = await tx.query(`
      INSERT INTO users
        (company_id, role_id, username, first_name, last_name, display_name,
         password_hash, password_salt, password_iterations, manager_id, status, is_active,
         remarks, created_by, updated_by)
      VALUES
        (@companyId, (SELECT id FROM roles WHERE code = @employee), @username, @firstName,
         @lastName, @displayName, @passwordHash, @passwordSalt, @passwordIterations, @managerId,
         1, true, @mark, @managerId, @managerId)
      RETURNING id`, {
      companyId,
      employee: ROLES.EMPLOYEE,
      username: `demo.${rep.firstName}.${rep.lastName}`.toLowerCase(),
      firstName: rep.firstName,
      lastName: rep.lastName,
      displayName: `${rep.firstName} ${rep.lastName}`,
      managerId: ctx.manager_id,
      mark: MARK,
      ...hashed,
    });
    return rows[0].id;
  });
}

async function insertDoctors(tx, companyId, ctx, doctors) {
  const { rows } = await tx.query(`
    INSERT INTO accounts
      (company_id, name, city, country, latitude, longitude, notes, created_by, updated_by)
    SELECT @companyId, d.name, d.city, 'India', d.latitude, d.longitude, @mark,
           @managerId, @managerId
    FROM unnest(@names::varchar[], @cities::varchar[], @lats::numeric[], @lngs::numeric[])
      WITH ORDINALITY AS d (name, city, latitude, longitude, n)
    ORDER BY d.n
    RETURNING id, name`, {
    companyId,
    mark: MARK,
    managerId: ctx.manager_id,
    names: doctors.map((d) => d.name),
    cities: doctors.map((d) => d.city),
    lats: doctors.map((d) => d.latitude),
    lngs: doctors.map((d) => d.longitude),
  });
  const byName = new Map(rows.map((row) => [row.name, row.id]));
  return doctors.map((d) => byName.get(d.name));
}

async function insertAssignments(tx, companyId, ctx, plan, ids) {
  await tx.query(`
    INSERT INTO account_assignments
      (company_id, account_id, user_id, visits_per_month, created_by, updated_by)
    SELECT @companyId, a.account_id, a.user_id, a.per_month, @managerId, @managerId
    FROM unnest(@accountIds::int[], @userIds::int[], @perMonth::smallint[])
      AS a (account_id, user_id, per_month)`, {
    companyId,
    managerId: ctx.manager_id,
    accountIds: plan.assignments.map((a) => ids.doctors[a.doctor]),
    userIds: plan.assignments.map((a) => ids.reps[a.rep]),
    perMonth: plan.assignments.map((a) => a.visitsPerMonth),
  });
}

async function insertVisit(tx, companyId, ctx, visit) {
  const params = {
    companyId,
    ...visit,
    timeZone: ctx.time_zone,
    typeId: ctx.activity_type_id,
    managerId: ctx.manager_id,
    planMonth: `${visit.month}-01`,
  };
  const { rows } = await tx.query(`
    INSERT INTO activities
      (company_id, activity_type_id, account_id, assigned_to, assigned_by, title, status,
       due_at, completed_at, source, plan_month, created_by, updated_by)
    VALUES
      (@companyId, @typeId, @accountId, @userId, @managerId, @title, @status::varchar,
       (@date::date + time '18:00') AT TIME ZONE @timeZone,
       CASE WHEN @status::varchar = 'Completed'
         THEN (@date::date + time '12:30') AT TIME ZONE @timeZone END,
       'PLAN', @planMonth::date, @managerId, @managerId)
    RETURNING id`, params);
  if (visit.status !== "Completed") return;
  const submission = `
    INSERT INTO submissions
      (company_id, activity_id, submitted_by, check_in_at, check_in_latitude,
       check_in_longitude, check_out_at, notes, rating, review_status, reviewed_by,
       reviewed_at, submitted_at, created_by, updated_by)
    VALUES
      (@companyId, @activityId, @userId, (@date::date + time '12:05') AT TIME ZONE @timeZone,
       @latitude, @longitude, (@date::date + time '12:30') AT TIME ZONE @timeZone,
       'Demo visit: discussed the new product range.', 4, @review::varchar,
       CASE WHEN @review::varchar <> 'Pending' THEN @managerId::int END,
       CASE WHEN @review::varchar <> 'Pending'
         THEN (@date::date + time '20:00') AT TIME ZONE @timeZone END,
       (@date::date + time '12:30') AT TIME ZONE @timeZone, @userId, @userId)`;
  await tx.query(submission, { ...params, activityId: rows[0].id });
}

async function seedCompany(db, companyId, ctx, plan) {
  const hashed = await passwordService.hashPassword(crypto.randomBytes(32).toString("hex"));
  return db.withTransaction(async (tx) => {
    const ids = {
      reps: await insertReps(tx, companyId, ctx, plan.reps, hashed),
      doctors: await insertDoctors(tx, companyId, ctx, plan.doctors),
    };
    await insertAssignments(tx, companyId, ctx, plan, ids);
    await inSequence(plan.visits, (visit) => {
      const doctor = plan.doctors[visit.doctor];
      return insertVisit(tx, companyId, ctx, {
        accountId: ids.doctors[visit.doctor],
        userId: ids.reps[visit.rep],
        title: `Visit: ${doctor.name}`,
        latitude: doctor.latitude,
        longitude: doctor.longitude,
        ...visit,
      });
    });
    return plan.visits.length;
  });
}

// Deletes demo users and doctors with everything attached to them, children first.
async function removeCompany(db, companyId) {
  const scope = `company_id = @companyId AND (
      account_id IN (SELECT id FROM accounts WHERE company_id = @companyId AND notes = @mark)`;
  const params = { companyId, mark: MARK };
  return db.withTransaction(async (tx) => {
    const demoUsers = "(SELECT id FROM users WHERE company_id = @companyId AND remarks = @mark)";
    const visits = `SELECT id FROM activities WHERE ${scope} OR assigned_to IN ${demoUsers})`;
    await tx.query(`DELETE FROM submissions WHERE activity_id IN (${visits})`, params);
    const removed = await tx.query(`DELETE FROM activities WHERE id IN (${visits})`, params);
    await tx.query(
      `DELETE FROM account_assignments WHERE ${scope} OR user_id IN ${demoUsers})`,
      params,
    );
    await tx.query("DELETE FROM accounts WHERE company_id = @companyId AND notes = @mark", params);
    await tx.query("DELETE FROM users WHERE company_id = @companyId AND remarks = @mark", params);
    return removed.rowCount;
  });
}

function describe(plan) {
  const done = plan.visits.filter((v) => v.status === "Completed").length;
  const missed = plan.visits.filter((v) => v.status === "Missed").length;
  return `${plan.reps.length} reps, ${plan.doctors.length} doctors, `
    + `${plan.visits.length} visits (${done} completed, ${missed} missed, rest pending)`;
}

async function runCompany(db, companyId, index, { confirmed, remove, out }) {
  const ctx = await loadContext(db, companyId);
  if (!ctx) return out(`Company ${companyId}: not found, skipped.\n`);
  const label = `Company ${companyId} (${ctx.name})`;
  if (remove) {
    if (!confirmed) return out(`${label}: would remove ${ctx.demo_users} demo reps and data.\n`);
    return out(`${label}: removed demo data (${await removeCompany(db, companyId)} visits).\n`);
  }
  if (ctx.demo_users > 0) return out(`${label}: already has demo data, skipped (--remove).\n`);
  if (!ctx.manager_id || !ctx.activity_type_id) {
    return out(`${label}: needs an active Manager/Admin and a visit type first, skipped.\n`);
  }
  const plan = buildDemoPlan({ companyId, index, today: ctx.today });
  if (!confirmed) return out(`${label}: would add ${describe(plan)}.\n`);
  await seedCompany(db, companyId, ctx, plan);
  return out(`${label}: added ${describe(plan)}.\n`);
}

// Returns the process exit code. `db` is src/config/db (or a fake with the same API).
async function main(argv, { env, out, db }) {
  const options = parseArgs(argv);
  if (!options.urlEnv || options.companyIds.some((id) => !Number.isInteger(id))) {
    out(USAGE);
    return 1;
  }
  const url = env[options.urlEnv];
  if (!url) throw new Error(`${options.urlEnv} is not set.`);
  out(`Target: ${options.urlEnv}\n`);
  await db.configure({ url });
  try {
    await inSequence(options.companyIds, (companyId, index) => runCompany(
      db,
      companyId,
      index,
      { ...options, out },
    ));
    if (!options.confirmed) out("Dry run only. Re-run with --yes to write.\n");
    return 0;
  } finally {
    await db.closePool();
  }
}

if (require.main === module) {
  // eslint-disable-next-line n/global-require -- CLI only: load backend/.env before reading it
  require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });
  main(process.argv, {
    env: process.env,
    out: (text) => process.stdout.write(text),
    // eslint-disable-next-line n/global-require -- lazy, after .env is loaded
    db: require("../src/config/db"),
  }).then((code) => {
    process.exitCode = code;
  }).catch((err) => {
    process.stderr.write(`Demo seed failed: ${err.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs, main, runCompany, MARK,
};
