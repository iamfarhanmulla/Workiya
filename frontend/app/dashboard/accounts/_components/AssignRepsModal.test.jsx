import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import AssignRepsModal from "./AssignRepsModal";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), put: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));
jest.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({ t: (key) => ({ "rep.plural": "Reps" }[key] || key) }),
}));

const ACCOUNT = {
  id: 1, companyId: 5, name: "Dr Meera Shah", assignedUsers: [],
};

const EMPLOYEES = [
  {
    Id: 11, DisplayName: "Ravi Kumar", CompanyId: 5, IsActive: true,
  },
  {
    Id: 12, FirstName: "Asha", LastName: "Patel", CompanyId: 5, IsActive: true,
  },
  {
    Id: 13, DisplayName: "Other Company Rep", CompanyId: 9, IsActive: true,
  },
  {
    Id: 14, DisplayName: "Inactive Rep", CompanyId: 5, IsActive: false,
  },
];

const MANAGERS = [{
  Id: 21, DisplayName: "Mona Manager", CompanyId: 5, IsActive: true,
}];

// /employees/managers-list (open to managers) returns Id, Name and CompanyId only.
const MANAGERS_LIST = [{ Id: 21, Name: "Mona Manager", CompanyId: 5 }];

function mockGets(current = [{ userId: 11, visitsPerMonth: 2 }]) {
  api.get.mockImplementation((url) => {
    if (url === "/employees") return Promise.resolve({ data: { success: true, data: EMPLOYEES } });
    if (url === "/managers") return Promise.resolve({ data: { data: MANAGERS } });
    if (url === "/employees/managers-list") {
      return Promise.resolve({ data: { success: true, data: MANAGERS_LIST } });
    }
    return Promise.resolve({ data: { data: current } });
  });
}

function renderModal(callerRole = "ADMIN") {
  const onSaved = jest.fn();
  render(
    <AssignRepsModal
      account={ACCOUNT}
      callerRole={callerRole}
      onClose={jest.fn()}
      onSaved={onSaved}
    />,
  );
  return onSaved;
}

describe("AssignRepsModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends the selected reps with PUT", async () => {
    // Arrange
    mockGets();
    api.put.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    const onSaved = renderModal();
    const ravi = await screen.findByRole("checkbox", { name: /Ravi Kumar/ });
    await waitFor(() => expect(ravi).toBeChecked());

    // Act
    await user.click(screen.getByRole("checkbox", { name: /Asha Patel/ }));
    await user.type(screen.getByLabelText("Visits per month for Asha Patel"), "4");
    await user.click(screen.getByRole("checkbox", { name: /Mona Manager/ }));
    await user.click(screen.getByRole("button", { name: /Save Assignments/ }));

    // Assert
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith("/accounts/1/assignments", {
      assignments: [
        { userId: 12, visitsPerMonth: 4 },
        { userId: 21, visitsPerMonth: null },
        { userId: 11, visitsPerMonth: 2 },
      ],
    });
  });

  it("lists only active reps of the account's company", async () => {
    // Arrange
    mockGets();

    // Act
    renderModal();

    // Assert
    expect(await screen.findByRole("checkbox", { name: /Ravi Kumar/ })).toBeChecked();
    expect(screen.queryByText(/Other Company Rep/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Inactive Rep/)).not.toBeInTheDocument();
  });

  it("unchecks a rep and shows a server error", async () => {
    // Arrange
    mockGets();
    api.put.mockRejectedValue({ response: { data: { message: "Cross company." } } });
    const user = userEvent.setup();
    renderModal("MANAGER");

    const ravi = await screen.findByRole("checkbox", { name: /Ravi Kumar/ });
    await waitFor(() => expect(ravi).toBeChecked());

    // Act
    await user.click(ravi);
    await user.click(screen.getByRole("button", { name: /Save Assignments/ }));

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent("Cross company.");
    expect(api.put).toHaveBeenCalledWith("/accounts/1/assignments", { assignments: [] });
    expect(api.get).not.toHaveBeenCalledWith("/managers");
  });

  it("keeps a manager assignee when a MANAGER edits the assignments", async () => {
    // Arrange
    mockGets([{ userId: 11, visitsPerMonth: 2 }, { userId: 21, visitsPerMonth: 1 }]);
    api.put.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    const onSaved = renderModal("MANAGER");
    const mona = await screen.findByRole("checkbox", { name: /Mona Manager/ });
    await waitFor(() => expect(mona).toBeChecked());

    // Act
    await user.clear(screen.getByLabelText("Visits per month for Ravi Kumar"));
    await user.type(screen.getByLabelText("Visits per month for Ravi Kumar"), "3");
    await user.click(screen.getByRole("button", { name: /Save Assignments/ }));

    // Assert
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api.get).toHaveBeenCalledWith("/employees/managers-list");
    expect(api.put).toHaveBeenCalledWith("/accounts/1/assignments", {
      assignments: [
        { userId: 21, visitsPerMonth: 1 },
        { userId: 11, visitsPerMonth: 3 },
      ],
    });
  });
});
