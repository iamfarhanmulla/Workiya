import { render, screen } from "@testing-library/react";
import { api } from "@/lib/apiClient";
import SubmissionDetails from "./SubmissionDetails";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

const mockUseCustomFields = jest.fn(() => ({ fields: [], loading: false, reload: jest.fn() }));
jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: (...args) => mockUseCustomFields(...args),
}));

function mockSubmission(overrides) {
  api.get.mockResolvedValue({
    data: {
      success: true,
      data: {
        id: 9, companyId: 4, reviewStatus: "Approved", notes: "Met the doctor", ...overrides,
      },
    },
  });
}

function renderDetails() {
  render(
    <SubmissionDetails
      submissionId={9}
      title="Report"
      isStaff
      onReviewed={jest.fn()}
      showToast={jest.fn()}
    />,
  );
}

describe("SubmissionDetails", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("links a safe photo and reads the submission company's fields", async () => {
    // Arrange
    mockSubmission({ photoUrl: "https://files.example.com/p.jpg" });

    // Act
    renderDetails();

    // Assert
    expect(await screen.findByRole("link", { name: "View photo" }))
      .toHaveAttribute("href", "https://files.example.com/p.jpg");
    expect(mockUseCustomFields).toHaveBeenLastCalledWith("SUBMISSION", 4);
  });

  it("does not link off-site protocol-relative or backslash URLs", async () => {
    // Arrange
    mockSubmission({ photoUrl: "//evil.example/p.jpg", signatureUrl: "/\\evil.example" });

    // Act
    renderDetails();

    // Assert
    expect(await screen.findByText("Met the doctor")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View photo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View signature" })).not.toBeInTheDocument();
  });
});
