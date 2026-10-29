/* eslint-disable @stylistic/max-len -- readable one-line fixture rows */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import GeneratePlanModal from "./GeneratePlanModal";

jest.mock("@/lib/apiClient", () => ({
  api: { post: jest.fn(), get: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));
jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: () => ({ types: [{ id: 5, name: "Doctor Visit" }], loading: false }),
}));

const LABELS = { activities: "Visits", accounts: "Doctors" };
const ADMIN = { id: 10, companyId: 2, roleCode: "ADMIN" };
const PLAN = {
  month: "2026-11",
  workingDays: 25,
  activityType: { id: 5, name: "Doctor Visit" },
  items: [{
    accountId: 7, accountName: "Dr. Alpha", userId: 30, userName: "Eve", visitsPerMonth: 2, existing: 0, dates: ["2026-11-09", "2026-11-23"],
  }],
  totals: {
    reps: 1, accounts: 1, alreadyPlanned: 0, toCreate: 2,
  },
};

function renderModal() {
  const props = { onClose: jest.fn(), notify: jest.fn(), reload: jest.fn() };
  render(<GeneratePlanModal user={ADMIN} labels={LABELS} {...props} />);
  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GeneratePlanModal", () => {
  it("previews first, then creates the plan and reports the count", async () => {
    // Arrange
    api.post
      .mockResolvedValueOnce({ data: { data: PLAN } })
      .mockResolvedValueOnce({ data: { data: { month: "2026-11", created: 2 } } });
    const props = renderModal();
    const user = userEvent.setup();

    // Act
    await user.click(screen.getByRole("button", { name: /preview plan/i }));
    await screen.findByText("Dr. Alpha");
    await user.click(screen.getByRole("button", { name: /create 2 visit/i }));

    // Assert
    expect(api.post.mock.calls[0][0]).toBe("/visit-plans/preview");
    expect(api.post.mock.calls[0][1]).toEqual({ month: expect.stringMatching(/^\d{4}-\d{2}$/) });
    expect(api.post.mock.calls[1][0]).toBe("/visit-plans");
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("2 planned visits created."));
    expect(props.reload).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows the server's error message", async () => {
    // Arrange
    api.post.mockRejectedValueOnce({ response: { data: { message: "Choose a visit type." } } });
    renderModal();

    // Act
    await userEvent.click(screen.getByRole("button", { name: /preview plan/i }));

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a visit type.");
  });

  it("asks a super admin to choose a company first", async () => {
    // Arrange
    api.get.mockResolvedValue({ data: { data: [{ Id: 2, Name: "Sawant", IsActive: true }] } });
    render(
      <GeneratePlanModal
        user={{ id: 1, roleCode: "SUPER_ADMIN" }}
        labels={LABELS}
        onClose={jest.fn()}
        notify={jest.fn()}
        reload={jest.fn()}
      />,
    );

    // Act
    const preview = screen.getByRole("button", { name: /preview plan|working/i });

    // Assert
    expect(preview).toBeDisabled();
    expect(await screen.findByRole("option", { name: "Sawant" })).toBeInTheDocument();
  });
});
