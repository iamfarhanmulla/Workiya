jest.mock("../repositories/submission.repository");
jest.mock("./audit.service");
jest.mock("./customFields.service");
jest.mock("./companyContext");

const submissionRepository = require("../repositories/submission.repository");
const audit = require("./audit.service");
const customFields = require("./customFields.service");
const submissionService = require("./submission.service");
const { USERS } = require("../../test/helpers/apiHarness");
const {
  NOW, ACCOUNT, activityContext, submissionRow, context,
} = require("../../test/helpers/fieldWorkFixtures");

const CHECK_IN = {
  checkInAtUtc: NOW.toISOString(),
  checkInLatitude: ACCOUNT.lat,
  checkInLongitude: ACCOUNT.lon,
};

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
        activityContext({ status }),
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
    [{ min_photos: 1 }, /photo/],
    [{ requires_signature: true }, /signature/],
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
    [{ requires_customer_otp: true }, /customer OTP/],
    [{ min_photos: 3 }, /requires 3 photos/],
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
      activityContext({ requires_check_in: false }),
    );

    // Act
    const result = submissionService.createSubmission(context(), 5, { notes: "x" });

    // Assert
    await expect(result).rejects.toMatchObject({ status: 400, errorCode: "VALIDATION_FAILED" });
  });

  it("refuses a geofenced submit when the account has no coordinates", async () => {
    // Arrange
    submissionRepository.findActivityForSubmission.mockResolvedValue(activityContext({
      account_latitude: null, account_longitude: null,
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
      verify(activityContext({ account_latitude: ACCOUNT.lat + 0.01 }));
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
      requires_check_in: false,
      geofence_meters: null,
      account_latitude: null,
      account_longitude: null,
    }));
    submissionRepository.createAndCompleteActivity.mockResolvedValue({ id: 40 });
    submissionRepository.findById.mockResolvedValue(submissionRow({ answers: null }));

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
