import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import TransferModal from "./TransferModal";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

const EMPLOYEES = [
  {
    Id: 11, DisplayName: "Ravi Kumar", CompanyId: 5, IsActive: false,
  },
  {
    Id: 12, DisplayName: "Asha Patel", CompanyId: 5, IsActive: true,
  },
  {
    Id: 13, DisplayName: "Elsewhere", CompanyId: 9, IsActive: true,
  },
];

function renderModal(callerRole) {
  const onDone = jest.fn();
  render(
    <TransferModal plural="Doctors" callerRole={callerRole} onClose={jest.fn()} onDone={onDone} />,
  );
  return onDone;
}

async function chooseUsers(user) {
  await user.selectOptions(
    screen.getByLabelText("From"),
    await screen.findByRole("option", { name: "Ravi Kumar (inactive)" }),
  );
  await user.selectOptions(screen.getByLabelText("To"), "12");
  await user.click(screen.getByRole("button", { name: /^swap_horiz\s*Transfer$/ }));
}

describe("TransferModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation((url) => Promise.resolve({
      data: { success: true, data: url === "/employees" ? EMPLOYEES : [] },
    }));
  });

  it("posts the transfer and reports the moved count", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { moved: 3 } } });
    const user = userEvent.setup();
    const onDone = renderModal("ADMIN");

    // Act
    await chooseUsers(user);

    // Assert
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(3));
    expect(api.post).toHaveBeenCalledWith(
      "/accounts/assignments/transfer",
      { fromUserId: 11, toUserId: 12 },
    );
  });

  it("sends the company for a super admin and offers only same-company targets", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { moved: 0 } } });
    const user = userEvent.setup();
    renderModal("SUPER_ADMIN");

    // Act
    await chooseUsers(user);

    // Assert
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/accounts/assignments/transfer",
      { fromUserId: 11, toUserId: 12, companyId: 5 },
    ));
    expect(screen.queryByRole("option", { name: "Elsewhere" })).toBeInTheDocument();
    expect(screen.getByLabelText("To")).not.toHaveTextContent("Elsewhere");
  });

  it("asks for both users before posting and shows server errors", async () => {
    // Arrange
    api.post.mockRejectedValue({ response: { data: { message: "Not in company." } } });
    const user = userEvent.setup();
    renderModal("MANAGER");
    await screen.findByRole("option", { name: "Asha Patel" });

    // Act
    await user.click(screen.getByRole("button", { name: /^swap_horiz\s*Transfer$/ }));
    const firstError = screen.getByRole("alert").textContent;
    await chooseUsers(user);

    // Assert
    expect(firstError).toBe("Choose both users.");
    expect(await screen.findByText("Not in company.")).toBeInTheDocument();
  });
});
