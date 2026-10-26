const { useTestDb, closeTestDb, seedBasics } = require("./helpers/testDb");
const activityRepository = require("../../src/repositories/activity.repository");
const submissionRepository = require("../../src/repositories/submission.repository");
const activityService = require("../../src/services/activity.service");
const submissionService = require("../../src/services/submission.service");
const { isForeignKeyViolation } = require("../../src/config/dbErrors");
const { USERS } = require("../helpers/apiHarness");

const COMPANY = 2;
const OTHER_COMPANY_EMPLOYEE = 40;
// The account sits in central Pune; the fence test checks in about 1.3 km away.
const ACCOUNT_LOCATION = { latitude: 18.5204303, longitude: 73.8567437 };
const FAR_CHECK_IN = { checkInLatitude: 18.5320000, checkInLongitude: 73.8567437 };
const PAGE = { page: 1, pageSize: 20 };

let db;
let refs;

function contextOf(user) {
  return { user, ip: "10.0.0.1", userAgent: "integration-test" };
}

async function insertActivityType(code, { geofenceMeters = null } = {}) {
  const { rows } = await db.query(`
    INSERT INTO activity_types (company_id, code, name, requires_check_in, geofence_meters)
    VALUES (@companyId, @code, @code, false, @geofenceMeters)
    RETURNING id`, { companyId: COMPANY, code, geofenceMeters });
  return rows[0].id;
}

async function seedFieldWork() {
  await seedBasics();
  const account = await db.query(`
    INSERT INTO accounts (company_id, name, latitude, longitude)
    VALUES (@companyId, 'City Clinic', @latitude, @longitude)
    RETURNING id`, { companyId: COMPANY, ...ACCOUNT_LOCATION });
  return {
    accountId: account.rows[0].id,
    activityTypeId: await insertActivityType("VISIT"),
    fencedTypeId: await insertActivityType("FENCED_VISIT", { geofenceMeters: 100 }),
  };
}

function activityBody(overrides = {}) {
  return {
    activityTypeId: refs.activityTypeId,
    accountId: refs.accountId,
    assignedTo: USERS.employee.id,
    title: "Quarterly visit",
    description: null,
    priority: "High",
    dueAtUtc: "2026-11-02T10:00:00.000Z",
    ...overrides,
  };
}

function createActivity(overrides = {}) {
  return activityService.createActivity(contextOf(USERS.admin), activityBody(overrides));
}

function submitAs(user, activityId, body = {}) {
  return submissionService.createSubmission(contextOf(user), activityId, {
    notes: "Met the doctor", rating: 4, answers: {}, ...body,
  });
}

function submitDirect(activityId, verify) {
  return submissionRepository.createAndCompleteActivity({
    companyId: COMPANY,
    activityId,
    userId: USERS.employee.id,
    values: { notes: "Parallel submit", answers: {} },
    verify,
  });
}

async function activityState(id) {
  const { rows } = await db.query(`
    SELECT a.status, a.completed_at,
      (SELECT COUNT(*) FROM submissions s WHERE s.activity_id = a.id) AS submissions
    FROM activities a WHERE a.id = @id`, { id });
  return rows[0];
}

beforeAll(async () => {
  db = await useTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  refs = await seedFieldWork();
});

describe("activities on PostgreSQL", () => {
  it("creates an activity and lists it with its latest submission", async () => {
    // Arrange
    const created = await createActivity();
    await submitAs(USERS.employee, created.id);

    // Act
    const query = { ...PAGE, search: "quarterly" };
    const listed = await activityService.listActivities(USERS.admin, query);

    // Assert
    expect(created).toMatchObject({
      companyId: COMPANY,
      accountName: "City Clinic",
      assignedToName: "Eve Employee",
      assignedByName: "Ada Admin",
      status: "Pending",
      dueAtUtc: "2026-11-02T10:00:00.000Z",
      latestSubmission: null,
    });
    expect(listed.total).toBe(1);
    expect(listed.items[0]).toMatchObject({ id: created.id, status: "Completed" });
    expect(listed.items[0].latestSubmission).toMatchObject({ reviewStatus: "Pending" });
    expect(listed.items[0].latestSubmission.submittedAtUtc).toEqual(expect.any(String));
  });

  it("shows an employee only the activities assigned to them", async () => {
    // Arrange
    const own = await createActivity();
    const managers = await createActivity({ assignedTo: USERS.manager.id, title: "Manager visit" });

    // Act
    const listed = await activityService.listActivities(USERS.employee, PAGE);
    const hidden = activityService.getActivity(USERS.employee, managers.id);

    // Assert
    expect(listed.total).toBe(1);
    expect(listed.items.map((item) => item.id)).toEqual([own.id]);
    await expect(hidden).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a user of another company as assignee (service and foreign key)", async () => {
    // Arrange
    const fields = activityBody({ assignedTo: OTHER_COMPANY_EMPLOYEE });

    // Act
    const viaService = createActivity({ assignedTo: OTHER_COMPANY_EMPLOYEE });
    const viaRepository = activityRepository.insert(COMPANY, fields, USERS.admin.id)
      .catch((err) => err);

    // Assert
    await expect(viaService).rejects.toMatchObject({ errorCode: "CROSS_COMPANY_REFERENCE" });
    expect(isForeignKeyViolation(await viaRepository)).toBe(true);
  });

  it("writes the old row to activities_history on a status change", async () => {
    // Arrange
    const created = await createActivity();

    // Act
    await activityService.changeActivityStatus(contextOf(USERS.employee), created.id, "InProgress");
    const { rows } = await db.query(`
      SELECT status, valid_from, valid_to FROM activities_history
      WHERE id = @id ORDER BY valid_to`, { id: created.id });

    // Assert
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("Pending");
    expect(rows[0].valid_to).toBeInstanceOf(Date);
    expect(rows[0].valid_to.getTime()).toBeGreaterThanOrEqual(rows[0].valid_from.getTime());
  });
});

describe("submissions on PostgreSQL", () => {
  it("saves the submission and completes the activity in one transaction", async () => {
    // Arrange
    const created = await createActivity();

    // Act
    const submission = await submitAs(USERS.employee, created.id);
    const state = await activityState(created.id);

    // Assert
    expect(submission).toMatchObject({
      activityId: created.id, reviewStatus: "Pending", rating: 4, answers: {},
    });
    expect(state.status).toBe("Completed");
    expect(state.completed_at).toBeInstanceOf(Date);
    expect(state.submissions).toBe(1);
  });

  it("rolls everything back when the locked rules fail (geofence)", async () => {
    // Arrange
    const created = await createActivity({ activityTypeId: refs.fencedTypeId });
    const body = { checkInAtUtc: "2026-11-02T09:00:00.000Z", ...FAR_CHECK_IN };

    // Act
    const outcome = submitAs(USERS.employee, created.id, body);

    // Assert
    await expect(outcome).rejects.toMatchObject({ errorCode: "OUTSIDE_GEOFENCE" });
    expect(await activityState(created.id)).toMatchObject({ status: "Pending", submissions: 0 });
  });

  it("lets exactly one of two parallel submits for an activity succeed", async () => {
    // Arrange
    const created = await createActivity();

    // Act
    const outcomes = await Promise.all([submitDirect(created.id), submitDirect(created.id)]);

    // Assert
    expect(outcomes.filter((outcome) => outcome.id)).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.error)).toHaveLength(1);
    expect(await activityState(created.id)).toMatchObject({ status: "Completed", submissions: 1 });
  });

  it("makes a submit wait for the activity lock and then see the open submission", async () => {
    // Arrange
    const created = await createActivity();
    let competitor;
    let settled = false;
    let settledWhileLocked;

    // Act
    await db.withTransaction(async (tx) => {
      await tx.query("SELECT id FROM activities WHERE id = @id FOR UPDATE", { id: created.id });
      await tx.query(`
        INSERT INTO submissions (company_id, activity_id, submitted_by, answers)
        VALUES (@companyId, @id, @userId, '{}')`, {
        companyId: COMPANY, id: created.id, userId: USERS.employee.id,
      });
      competitor = submitDirect(created.id).finally(() => {
        settled = true;
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      settledWhileLocked = settled;
    });
    const outcome = await competitor;

    // Assert
    expect(settledWhileLocked).toBe(false);
    expect(outcome).toEqual({ error: "DUPLICATE" });
    expect(await activityState(created.id)).toMatchObject({ status: "Pending", submissions: 1 });
  });

  it("reviews: no self-review, a rejection reopens the activity, no second review", async () => {
    // Arrange
    const created = await createActivity();
    const submission = await submitAs(USERS.employee, created.id);
    const review = (user, status) => submissionService.reviewSubmission(
      contextOf(user),
      submission.id,
      { status, comment: "Photo missing" },
    );

    // Act
    const selfReview = await review(USERS.employee, "Approved").catch((err) => err);
    const rejected = await review(USERS.manager, "Rejected");
    const again = await review(USERS.admin, "Approved").catch((err) => err);

    // Assert
    expect(selfReview).toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    expect(rejected).toMatchObject({
      reviewStatus: "Rejected", reviewedBy: USERS.manager.id, reviewedByName: "Max Manager",
    });
    expect(rejected.reviewedAtUtc).toEqual(expect.any(String));
    expect(await activityState(created.id))
      .toMatchObject({ status: "InProgress", completed_at: null });
    expect(again).toMatchObject({ status: 422, errorCode: "INVALID_STATUS_TRANSITION" });
  });

  it("keeps a cancelled activity cancelled when its submission is rejected", async () => {
    // Arrange
    const created = await createActivity();
    const submission = await submitAs(USERS.employee, created.id);
    await activityService.changeActivityStatus(contextOf(USERS.admin), created.id, "Cancelled");

    // Act
    const result = await submissionRepository.review({
      id: submission.id,
      scope: { companyId: COMPANY, unrestricted: false, userId: null },
      status: "Rejected",
      comment: null,
      userId: USERS.manager.id,
    });

    // Assert
    expect(result).toMatchObject({ activityStatus: "Cancelled", reopened: false });
    expect(await activityState(created.id)).toMatchObject({ status: "Cancelled" });
  });
});
