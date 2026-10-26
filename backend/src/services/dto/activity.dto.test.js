const { toActivityDto, toJsonObject } = require("./activity.dto");
const { toSubmissionDto } = require("./submission.dto");
const {
  NOW, activityRow, submissionRow,
} = require("../../../test/helpers/fieldWorkFixtures");

describe("activity.dto", () => {
  it("maps a snake_case row to the camelCase API shape with ISO dates", () => {
    // Arrange
    const row = activityRow({
      due_at: NOW,
      latest_submission_id: 9,
      latest_submission_review_status: "Approved",
      latest_submission_submitted_at: NOW,
    });

    // Act
    const dto = toActivityDto(row);

    // Assert
    expect(dto).toMatchObject({
      id: 5,
      companyId: 2,
      activityTypeName: "Doctor Visit",
      assignedToName: "Emp",
      dueAtUtc: NOW.toISOString(),
      completedAtUtc: null,
      createdAtUtc: NOW.toISOString(),
      latestSubmission: { id: 9, reviewStatus: "Approved", submittedAtUtc: NOW.toISOString() },
    });
  });

  it("returns null for joined names and dates that are missing", () => {
    // Arrange
    const row = { id: 1, title: "T", status: "Pending" };

    // Act
    const dto = toActivityDto(row);

    // Assert
    expect(dto).toMatchObject({
      activityTypeName: null,
      accountName: null,
      assignedToName: null,
      assignedByName: null,
      description: null,
      dueAtUtc: null,
      createdAtUtc: null,
      latestSubmission: null,
    });
  });

  it.each([
    [{ a: 1 }, { a: 1 }],
    [null, {}],
    [["x"], {}],
    ["text", {}],
  ])("reads jsonb %j as the object %j", (value, expected) => {
    // Arrange / Act
    const result = toJsonObject(value);

    // Assert
    expect(result).toEqual(expected);
  });
});

describe("submission.dto", () => {
  it("maps a snake_case row with numbers, dates and the answers object", () => {
    // Arrange
    const row = submissionRow({ reviewed_by: 20, reviewed_at: NOW, check_out_latitude: 1.5 });

    // Act
    const dto = toSubmissionDto(row);

    // Assert
    expect(dto).toMatchObject({
      id: 40,
      activityTitle: "Visit",
      checkInAtUtc: NOW.toISOString(),
      checkOutLatitude: 1.5,
      rating: 4,
      answers: { met: true },
      reviewedBy: 20,
      reviewedAtUtc: NOW.toISOString(),
      submittedAtUtc: NOW.toISOString(),
    });
  });

  it("returns null for every optional value that is missing", () => {
    // Arrange
    const row = { id: 1, review_status: "Pending" };

    // Act
    const dto = toSubmissionDto(row);

    // Assert
    expect(dto).toMatchObject({
      activityTitle: null,
      accountName: null,
      submittedByName: null,
      checkInLatitude: null,
      photoUrl: null,
      signatureUrl: null,
      notes: null,
      rating: null,
      answers: {},
      reviewedBy: null,
      reviewedByName: null,
      reviewComment: null,
      submittedAtUtc: null,
    });
  });
});
