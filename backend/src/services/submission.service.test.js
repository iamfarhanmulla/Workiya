jest.mock("../repositories/submission.repository");
jest.mock("./audit.service");
jest.mock("./customFields.service");
jest.mock("./companyContext");

const submissionRepository = require("../repositories/submission.repository");
const audit = require("./audit.service");
const customFields = require("./customFields.service");
const submissionService = require("./submission.service");
const { USERS } = require("../../test/helpers/apiHarness");

const NOW = new Date("2026-10-21T10:00:00.000Z");
const ACCOUNT = { lat: 19.076, lon: 72.8777 };

function activityContext(overrides = {}) {
  return {
    Id: 5,
    CompanyId: 2,
    AssignedTo: USERS.employee.id,
    Status: "InProgress",
    Title: "Visit",
    RequiresCheckIn: true,
    GeofenceMeters: 100,
    MinPhotos: 0,
    RequiresSignature: false,
    AccountLatitude: ACCOUNT.lat,
    AccountLongitude: ACCOUNT.lon,
    ...overrides,
  };
}

function submissionRow(overrides = {}) {
  return {
    Id: 40,
    CompanyId: 2,
    ActivityId: 5,
    ActivityTitle: "Visit",
    AccountName: "Dr. Rao",
    SubmittedBy: USERS.employee.id,
    SubmittedByName: "Emp",
    CheckInAtUtc: NOW,
    CheckInLatitude: ACCOUNT.lat,
    CheckInLongitude: ACCOUNT.lon,
    CheckOutAtUtc: null,
    CheckOutLatitude: null,
    CheckOutLongitude: null,
    PhotoUrl: null,
    SignatureUrl: null,
    Notes: "ok",
    Rating: 4,
    Answers: "{\"met\":true}",
    ReviewStatus: "Pending",
    ReviewedBy: null,
    ReviewedByName: null,
    ReviewedAtUtc: null,
    ReviewComment: null,
    SubmittedAtUtc: NOW,
    ...overrides,
  };
}

const CHECK_IN = {
  checkInAtUtc: NOW.toISOString(),
  checkInLatitude: ACCOUNT.lat,
  checkInLongitude: ACCOUNT.lon,
};

function context(user = USERS.employee) {
  return { user, ip: "10.0.0.1", userAgent: "jest" };
}

beforeEach(() => {
  audit.log.mockResolvedValue(undefined);
  customFields.validateValues.mockResolvedValue({ ok: true, value: { met: true } });
});

describe("submission.service.createSubmission", () => {
  it("saves the submission, completes the activity and audits both", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());
    submissionRepository.createAndCompleteActivity.mockResolvedValue({
      id: 40, previousStatus: "InProgress",
    });
    submissionRepository.findById.mockResolvedValue(submissionRow());

    // Act
    const dto = await submissionService.createSubmission(context(), 5, {
      ...CHECK_IN, answers: { met: true, extra: 1 },
    });

    // Assert
    expect(customFields.validateValues).toHaveBeenCalledWith(2, "SUBMISSION", {
      met: true, extra: 1,
    });
    expect(submissionRepository.createAndCompleteActivity).toHaveBeenCalledWith({
      companyId: 2,
      activityId: 5,
      userId: USERS.employee.id,
      values: { ...CHECK_IN, answers: { met: true } },
      verify: expect.any(Function),
    });
    expect(dto).toMatchObject({
      id: 40, answers: { met: true }, reviewStatus: "Pending", rating: 4,
    });
    expect(audit.log.mock.calls.map(([entry]) => entry.eventType)).toEqual([
      "SUBMISSION_CREATED", "ACTIVITY_STATUS_CHANGED",
    ]);
    expect(audit.log).toHaveBeenLastCalledWith(expect.objectContaining({
      entityId: 5, oldValue: { status: "InProgress" },
    }));
  });

  it("returns 404 when the activity is not visible to the caller", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(null);

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404, errorCode: "NOT_FOUND" });
  });

  it("returns 403 when a manager submits someone else's activity", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());

    // Act
    const result = submissionService.createSubmission(context(USERS.manager), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 403, errorCode: "FORBIDDEN" });
    expect(submissionRepository.createAndCompleteActivity).not.toHaveBeenCalled();
  });

  it.each(["Completed", "Cancelled", "Missed"])(
    "returns 422 INVALID_STATUS_TRANSITION for a %s activity",
    async (status) => {
      // Arrange
      submissionRepository.findActivityForSubmission.mockResolvedValue(
        activityContext({ Status: status }),
      );

      // Act
      const result = submissionService.createSubmission(context(), 5, CHECK_IN);

      // Assert
      await expect(result).rejects.toMatchObject({
        status: 422, errorCode: "INVALID_STATUS_TRANSITION",
      });
    },
  );

  it("requires check-in time and location when the type demands it", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());

    // Act
    const result = submissionService.createSubmission(context(), 5, {
      checkInLatitude: ACCOUNT.lat, checkInLongitude: ACCOUNT.lon,
    });

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 400, errorCode: "VALIDATION_FAILED", message: expect.stringMatching(/Check-in/),
    });
  });

  it.each([
    [{ MinPhotos: 1 }, /photo/],
    [{ RequiresSignature: true }, /signature/],
  ])("enforces the type's evidence rule %o", async (rule, message) => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext(rule));

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 400, message: expect.stringMatching(message),
    });
  });

  it.each([
    [{ RequiresCustomerOtp: true }, /customer OTP/],
    [{ MinPhotos: 3 }, /requires 3 photos/],
  ])("returns 422 for a type rule a submission cannot meet %o", async (rule, message) => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext(rule));

    // Act
    const result = submissionService.createSubmission(context(), 5, {
      ...CHECK_IN, photoUrl: "https://cdn.example.com/p.jpg",
    });

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 422, errorCode: "VALIDATION_FAILED", message: expect.stringMatching(message),
    });
    expect(submissionRepository.createAndCompleteActivity).not.toHaveBeenCalled();
  });

  it("returns 422 OUTSIDE_GEOFENCE with the distance in metres", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());

    // Act
    const result = submissionService.createSubmission(context(), 5, {
      ...CHECK_IN, checkInLatitude: ACCOUNT.lat + 0.01,
    });

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 422,
      errorCode: "OUTSIDE_GEOFENCE",
      message: expect.stringMatching(/1112 m from the account; it must be within 100 m/),
    });
    expect(submissionRepository.createAndCompleteActivity).not.toHaveBeenCalled();
  });

  it("requires a check-in location for a geofence even without RequiresCheckIn", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(
      activityContext({ RequiresCheckIn: false }),
    );

    // Act
    const result = submissionService.createSubmission(context(), 5, { notes: "x" });

    // Assert
    await expect(result).rejects.toMatchObject({ status: 400, errorCode: "VALIDATION_FAILED" });
  });

  it("refuses a geofenced submit when the account has no coordinates", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext({
      AccountLatitude: null, AccountLongitude: null,
    }));

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 422,
      errorCode: "OUTSIDE_GEOFENCE",
      message: expect.stringMatching(/account has no location/),
    });
    expect(submissionRepository.createAndCompleteActivity).not.toHaveBeenCalled();
  });

  it("re-checks the rules on the type and account rows locked by the transaction", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());
    submissionRepository.createAndCompleteActivity.mockImplementation(async ({ verify }) => {
      verify(activityContext({ AccountLatitude: ACCOUNT.lat + 0.01 }));
      return { id: 40 };
    });

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 422, errorCode: "OUTSIDE_GEOFENCE" });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("needs no account location when the type has no geofence", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext({
      RequiresCheckIn: false, GeofenceMeters: null, AccountLatitude: null, AccountLongitude: null,
    }));
    submissionRepository.createAndCompleteActivity.mockResolvedValue({ id: 40 });
    submissionRepository.findById.mockResolvedValue(submissionRow({ Answers: null }));

    // Act
    const dto = await submissionService.createSubmission(context(), 5, { notes: "x" });

    // Assert
    expect(dto.answers).toEqual({});
  });

  it("returns 400 INVALID_EXTRA_FIELDS when answers fail the custom field rules", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());
    customFields.validateValues.mockResolvedValue({ ok: false, message: "met is required." });

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 400, errorCode: "INVALID_EXTRA_FIELDS", message: "met is required.",
    });
  });

  it.each([
    ["DUPLICATE", 409, "CONFLICT"],
    ["STATUS", 422, "INVALID_STATUS_TRANSITION"],
    ["NOT_ASSIGNEE", 403, "FORBIDDEN"],
    ["NOT_FOUND", 404, "NOT_FOUND"],
  ])("maps the in-transaction %s result to %i", async (error, status, errorCode) => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());
    submissionRepository.createAndCompleteActivity.mockResolvedValue({
      error, status: "Completed",
    });

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({ status, errorCode });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("returns 404 if the saved submission cannot be read back", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext());
    submissionRepository.createAndCompleteActivity.mockResolvedValue({ id: 40 });
    submissionRepository.findById.mockResolvedValue(null);

    // Act
    const result = submissionService.createSubmission(context(), 5, CHECK_IN);

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});

describe("submission.service.reviewSubmission", () => {
  it("approves a pending submission and audits the review only", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({
      companyId: 2, activityId: 5, activityStatus: "Completed",
    });
    submissionRepository.findById.mockResolvedValue(submissionRow({
      ReviewStatus: "Approved", ReviewedBy: USERS.manager.id, ReviewedAtUtc: NOW,
    }));

    // Act
    const dto = await submissionService.reviewSubmission(context(USERS.manager), 40, {
      status: "Approved",
    });

    // Assert
    expect(submissionRepository.review).toHaveBeenCalledWith({
      id: 40,
      scope: { companyId: 2, unrestricted: false, userId: null },
      status: "Approved",
      comment: undefined,
      userId: USERS.manager.id,
    });
    expect(dto).toMatchObject({ reviewStatus: "Approved", reviewedAtUtc: NOW.toISOString() });
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "SUBMISSION_REVIEWED",
      newValue: { reviewStatus: "Approved", comment: null },
    }));
  });

  it("re-opens the activity (InProgress) when rejecting and audits that change", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({
      companyId: 2, activityId: 5, activityStatus: "Completed", reopened: true,
    });
    submissionRepository.findById.mockResolvedValue(submissionRow({ ReviewStatus: "Rejected" }));

    // Act
    await submissionService.reviewSubmission(context(USERS.admin), 40, {
      status: "Rejected", comment: "Blurry photo",
    });

    // Assert
    expect(audit.log).toHaveBeenLastCalledWith(expect.objectContaining({
      eventType: "ACTIVITY_STATUS_CHANGED",
      entityId: 5,
      oldValue: { status: "Completed" },
      newValue: { status: "InProgress", rejectedSubmissionId: 40 },
    }));
  });

  it("audits no activity change when a rejection leaves a cancelled activity alone", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({
      companyId: 2, activityId: 5, activityStatus: "Cancelled", reopened: false,
    });
    submissionRepository.findById.mockResolvedValue(submissionRow({ ReviewStatus: "Rejected" }));

    // Act
    await submissionService.reviewSubmission(context(USERS.admin), 40, { status: "Rejected" });

    // Assert
    expect(audit.log).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "SUBMISSION_REVIEWED",
    }));
  });

  it("returns 403 when the reviewer submitted the submission", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({ error: "SELF_REVIEW" });

    // Act
    const result = submissionService.reviewSubmission(context(USERS.manager), 40, {
      status: "Approved",
    });

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 403, errorCode: "FORBIDDEN", message: "You cannot review your own submission.",
    });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("returns 422 when the submission was already reviewed", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({ error: "STATUS", status: "Approved" });

    // Act
    const result = submissionService.reviewSubmission(context(USERS.manager), 40, {
      status: "Rejected",
    });

    // Assert
    await expect(result).rejects.toMatchObject({
      status: 422,
      errorCode: "INVALID_STATUS_TRANSITION",
      message: expect.stringMatching(/already Approved/),
    });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it("returns 404 when the submission is not in the caller's company", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({ error: "NOT_FOUND" });

    // Act
    const result = submissionService.reviewSubmission(context(USERS.manager), 40, {
      status: "Approved",
    });

    // Assert
    await expect(result).rejects.toMatchObject({ status: 404 });
  });
});

describe("submission.service reads", () => {
  it("lists only the employee's own submissions", async () => {
    // Arrange
    submissionRepository.list.mockResolvedValue({ total: 1, rows: [submissionRow()] });

    // Act
    const page = await submissionService.listSubmissions(USERS.employee, {
      page: 2, pageSize: 10, reviewStatus: "Pending",
    });

    // Assert
    expect(submissionRepository.list).toHaveBeenCalledWith(
      { companyId: 2, unrestricted: false, userId: USERS.employee.id },
      { page: 2, pageSize: 10, reviewStatus: "Pending" },
    );
    expect(page).toMatchObject({ total: 1, page: 2, pageSize: 10 });
    expect(page.items[0]).toMatchObject({ id: 40, checkInLatitude: ACCOUNT.lat });
  });

  it("returns a submission or 404", async () => {
    // Arrange
    submissionRepository.findById
      .mockResolvedValueOnce(submissionRow({ Answers: "not json" }))
      .mockResolvedValueOnce(null);

    // Act
    const dto = await submissionService.getSubmission(USERS.manager, 40);
    const missing = submissionService.getSubmission(USERS.employee, 41);

    // Assert
    expect(dto.answers).toEqual({});
    await expect(missing).rejects.toMatchObject({ status: 404 });
  });
});
