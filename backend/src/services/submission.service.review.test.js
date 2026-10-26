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
  NOW, ACCOUNT, submissionRow, context,
} = require("../../test/helpers/fieldWorkFixtures");

beforeEach(() => {
  audit.log.mockResolvedValue(undefined);
  customFields.validateValues.mockResolvedValue({ ok: true, value: { met: true } });
});

describe("submission.service.reviewSubmission", () => {
  it("approves a pending submission and audits the review only", async () => {
    // Arrange
    submissionRepository.review.mockResolvedValue({
      companyId: 2, activityId: 5, activityStatus: "Completed",
    });
    submissionRepository.findById.mockResolvedValue(submissionRow({
      review_status: "Approved", reviewed_by: USERS.manager.id, reviewed_at: NOW,
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
    submissionRepository.findById.mockResolvedValue(submissionRow({ review_status: "Rejected" }));

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
    submissionRepository.findById.mockResolvedValue(submissionRow({ review_status: "Rejected" }));

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
      .mockResolvedValueOnce(submissionRow({ answers: ["not", "an", "object"] }))
      .mockResolvedValueOnce(null);

    // Act
    const dto = await submissionService.getSubmission(USERS.manager, 40);
    const missing = submissionService.getSubmission(USERS.employee, 41);

    // Assert
    expect(dto.answers).toEqual({});
    await expect(missing).rejects.toMatchObject({ status: 404 });
  });
});
