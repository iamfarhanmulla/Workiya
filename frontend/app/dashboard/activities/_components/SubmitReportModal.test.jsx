import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import SubmitReportModal from "./SubmitReportModal";

jest.mock("@/lib/apiClient", () => ({
  api: { post: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

const mockUseCustomFields = jest.fn(() => ({ fields: [], loading: false, reload: jest.fn() }));
jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: (...args) => mockUseCustomFields(...args),
}));

const PHOTO_TYPE = {
  id: 3, requiresCheckIn: false, minPhotos: 1, requiresSignature: true, isActive: true,
};
const mockUseActivityTypes = jest.fn(() => ({
  types: [PHOTO_TYPE], loading: false, reload: jest.fn(),
}));
jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: (...args) => mockUseActivityTypes(...args),
}));

const ACTIVITY = {
  id: 5, companyId: 2, activityTypeId: 3, title: "Visit Dr Shah",
};

function renderModal() {
  const showToast = jest.fn();
  const onSubmitted = jest.fn();
  render(
    <SubmitReportModal
      activity={ACTIVITY}
      labels={{ submission: "Visit Report" }}
      onClose={jest.fn()}
      onSubmitted={onSubmitted}
      showToast={showToast}
    />,
  );
  return { showToast, onSubmitted };
}

async function fillAndSubmit(user, photoUrl) {
  await user.type(screen.getByLabelText(/^Photo URL/), photoUrl);
  await user.type(screen.getByLabelText(/^Signature URL/), "/uploads/sign.png");
  await user.click(screen.getByRole("button", { name: /^Submit$/ }));
}

describe("SubmitReportModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reads the activity company's type and fields", () => {
    // Arrange / Act
    renderModal();

    // Assert
    expect(mockUseActivityTypes).toHaveBeenCalledWith(2);
    expect(mockUseCustomFields).toHaveBeenCalledWith("SUBMISSION", 2);
  });

  it("asks for the photo before posting when the type requires one", async () => {
    // Arrange
    const user = userEvent.setup();
    const { showToast } = renderModal();

    // Act
    await user.click(screen.getByRole("button", { name: /^Submit$/ }));

    // Assert
    expect(showToast).toHaveBeenCalledWith(
      "Photo URL is required for this visit type.",
      "warning",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("refuses a protocol-relative photo link", async () => {
    // Arrange
    const user = userEvent.setup();
    const { showToast } = renderModal();

    // Act
    await fillAndSubmit(user, "//evil.example/p.jpg");

    // Assert
    expect(showToast).toHaveBeenCalledWith(
      "Photo URL must be an http(s) URL or a /path.",
      "warning",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends the photo and signature links", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { id: 11 } } });
    const user = userEvent.setup();
    const { onSubmitted } = renderModal();

    // Act
    await fillAndSubmit(user, "https://files.example.com/p.jpg");

    // Assert
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith("Visit Report submitted."));
    expect(api.post).toHaveBeenCalledWith("/activities/5/submissions", expect.objectContaining({
      photoUrl: "https://files.example.com/p.jpg",
      signatureUrl: "/uploads/sign.png",
    }));
  });
});
