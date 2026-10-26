const { TABLES } = require("./copyMappings");
const {
  convertRows, planTable, buildPlan, newPlanContext, normalise, sortRows, compareTable,
  isTableVerified,
} = require("./copyRows");

const spec = (name) => TABLES.find((item) => item.target === name);
const CREATED = new Date("2026-04-06T10:19:20.494Z");

function user(id, companyId, extra = {}) {
  return {
    Id: id,
    CompanyId: companyId,
    Email: `u${id}@x.test`,
    RoleId: 3,
    ManagerId: null,
    CreatedAtUtc: CREATED,
    UpdatedAtUtc: null,
    IsDeleted: false,
    ...extra,
  };
}

function activity(id, companyId, assignedTo, assignedBy = assignedTo) {
  return {
    Id: id,
    CompanyId: companyId,
    AccountId: 1,
    ActivityTypeId: 2,
    AssignedTo: assignedTo,
    AssignedBy: assignedBy,
    Status: "Pending",
    CreatedAtUtc: CREATED,
    UpdatedAtUtc: CREATED,
    ValidFromUtc: CREATED,
  };
}

describe("convertRows", () => {
  it("maps source columns to target columns through their converters", () => {
    // Arrange
    const source = [user(19, 1, { ManagerId: 10, LegacyId: 5 })];

    // Act
    const { rows, errors } = convertRows(spec("users"), source);

    // Assert
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      id: 19, company_id: 1, email: "u19@x.test", manager_id: 10, updated_at: CREATED,
    });
    expect(rows[0]).not.toHaveProperty("LegacyId");
    expect(rows[0].last_login_at).toBeNull();
  });

  it("collects conversion errors with the id and column only", () => {
    // Arrange
    const source = [{
      Id: 7, CompanyId: 1, ExtraFields: "[1,2]", CreatedAtUtc: CREATED,
    }];

    // Act
    const { errors } = convertRows(spec("accounts"), source);

    // Assert
    expect(errors).toEqual([{ id: 7, column: "extra_fields", reason: "is not a JSON object" }]);
  });

  it("rethrows unexpected converter failures", () => {
    // Arrange
    const broken = {
      ...spec("genders"),
      columns: [{
        source: "Id",
        target: "id",
        convert: () => {
          throw new TypeError("bug");
        },
      }],
    };

    // Act
    const act = () => convertRows(broken, [{ Id: 1 }]);

    // Assert
    expect(act).toThrow(TypeError);
  });
});

describe("planTable / buildPlan", () => {
  it("rejects an activity assigned to a user of another company", () => {
    // Arrange
    const context = newPlanContext();
    planTable(spec("users"), [user(19, 1), user(20, 2)], context);

    // Act
    const plan = planTable(spec("activities"), [activity(1, 2, 19), activity(2, 2, 20)], context);

    // Assert
    expect(plan.sourceCount).toBe(2);
    expect(plan.rows.map((row) => row.id)).toEqual([2]);
    expect(plan.rejected).toEqual([
      { id: 1, label: "1", reason: "assigned_to user 19 belongs to company 1, not 2" },
    ]);
  });

  it("reports unknown users and skips children of skipped parents", () => {
    // Arrange
    const context = newPlanContext();
    planTable(spec("users"), [user(20, 2)], context);
    planTable(spec("activities"), [activity(1, 2, 99)], context);
    const submission = {
      Id: 4, CompanyId: 2, ActivityId: 1, SubmittedBy: 20, SubmittedAtUtc: CREATED,
    };

    // Act
    const activities = context.skippedIds.get("activities");
    const plan = planTable(spec("submissions"), [submission], context);

    // Assert
    expect(activities).toEqual(new Set([1]));
    expect(plan.rejected).toEqual([
      { id: 4, label: "4", reason: "activity_id 1 is not copied" },
    ]);
  });

  it("reports a user without a company as (none)", () => {
    // Arrange
    const context = newPlanContext();

    // Act
    const plan = planTable(spec("activities"), [activity(1, 2, 99)], context);

    // Assert
    expect(plan.rejected[0].reason).toBe("assigned_to user 99 belongs to company (none), not 2");
  });

  it("rejects assigned_by from another company unless that user is a super admin", () => {
    // Arrange
    const context = newPlanContext();
    planTable(
      spec("roles"),
      [{ Id: 1, Code: "SUPER_ADMIN" }, { Id: 3, Code: "EMPLOYEE" }],
      context,
    );
    planTable(spec("users"), [user(1, 1, { RoleId: 1 }), user(19, 1), user(20, 2)], context);

    // Act
    const plan = planTable(
      spec("activities"),
      [activity(1, 2, 20, 19), activity(2, 2, 20, 1)],
      context,
    );

    // Assert
    expect(plan.rows.map((row) => row.id)).toEqual([2]);
    expect(plan.rejected).toEqual([
      { id: 1, label: "1", reason: "assigned_by user 19 belongs to company 1, not 2" },
    ]);
  });

  it("skips history versions of skipped rows and of rows whose parent is skipped", () => {
    // Arrange
    const context = newPlanContext();
    planTable(spec("users"), [user(19, 1), user(20, 2)], context);
    planTable(spec("activities"), [activity(1, 2, 19), activity(2, 2, 20)], context);
    planTable(spec("submissions"), [], context);
    const version = (id, activityId) => ({
      Id: id, CompanyId: 2, ActivityId: activityId, SubmittedBy: 20, ValidToUtc: CREATED,
    });
    // Version of the skipped activity 1 (now valid) and an old cross-company version of 2.
    const activityVersions = [
      { ...activity(1, 2, 20), ValidToUtc: CREATED },
      { ...activity(2, 2, 19), ValidToUtc: CREATED },
    ];

    // Act
    const activities = planTable(spec("activities_history"), activityVersions, context);
    const submissions = planTable(
      spec("submissions_history"),
      [version(7, 1), version(8, 2)],
      context,
    );

    // Assert
    expect(activities.rows.map((row) => row.id)).toEqual([2]);
    expect(activities.rejected).toEqual([{
      id: 1,
      label: `1 (version until ${CREATED.toISOString()})`,
      reason: "activities id 1 is not copied",
    }]);
    expect(submissions.rows.map((row) => row.id)).toEqual([8]);
    expect(submissions.rejected.map((item) => [item.id, item.reason]))
      .toEqual([[7, "activity_id 1 is not copied"]]);
  });

  it("reads every table in order", async () => {
    // Arrange
    const tables = [spec("users"), spec("activities")];
    const readRows = jest.fn(async (item) => (item.target === "users"
      ? [user(19, 1)] : [activity(1, 1, 19)]));

    // Act
    const plan = await buildPlan(tables, readRows);

    // Assert
    expect(readRows.mock.calls.map(([item]) => item.target)).toEqual(["users", "activities"]);
    expect(plan.map((entry) => entry.rows.length)).toEqual([1, 1]);
  });
});

describe("compareTable", () => {
  const entry = {
    spec: spec("users"),
    rows: [
      {
        id: 2, company_id: 1, email: "b@x", role_id: 3, manager_id: 1,
      },
      {
        id: 1, company_id: 1, email: "a@x", role_id: 1, manager_id: null,
      },
    ],
  };

  it("passes when every row matches, regardless of order", () => {
    // Arrange
    const target = [{ ...entry.rows[1] }, { ...entry.rows[0] }];

    // Act
    const result = compareTable(entry, target);

    // Assert
    expect(result).toEqual({
      expected: 2, actual: 2, checked: 2, mismatches: [],
    });
    expect(isTableVerified(result)).toBe(true);
  });

  it("reports differing columns by id and a count mismatch", () => {
    // Arrange
    const target = [{ ...entry.rows[1], email: "other@x" }];

    // Act
    const result = compareTable(entry, target);

    // Assert
    expect(result.mismatches).toEqual([
      { id: 1, columns: ["email"] },
      { id: 2, columns: ["id", "company_id", "email", "role_id", "manager_id"] },
    ]);
    expect(result.actual).toBe(1);
    expect(isTableVerified(result)).toBe(false);
  });

  it("orders history rows by id and valid_to", () => {
    // Arrange
    const later = { id: 1, valid_to: new Date("2026-10-23T05:00:00Z") };
    const earlier = { id: 1, valid_to: new Date("2026-10-23T04:00:00Z") };

    // Act
    const sorted = sortRows(
      [later, earlier, { id: 0, valid_to: later.valid_to }],
      ["id", "valid_to"],
    );

    // Assert
    expect(sorted).toEqual([{ id: 0, valid_to: later.valid_to }, earlier, later]);
  });

  it("compares dates by instant", () => {
    // Arrange / Act / Assert
    expect(normalise(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01-01T00:00:00.000Z");
    expect(normalise(undefined)).toBeNull();
    expect(normalise(5)).toBe(5);
  });
});
