import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import ActivityFormModal from "./ActivityFormModal";

jest.mock("@/lib/apiClient", () => ({
  api: { post: jest.fn(), put: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

const TYPES_BY_COMPANY = {
  2: [{ id: 3, name: "Doctor visit", isActive: true }],
  4: [{ id: 8, name: "Store audit", isActive: true }],
};
const mockUseActivityTypes = jest.fn((companyId) => ({
  types: TYPES_BY_COMPANY[companyId] || [], loading: false, reload: jest.fn(),
}));
jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: (...args) => mockUseActivityTypes(...args),
}));

const ACCOUNTS = [
  { id: 10, companyId: 2, name: "Dr Shah" },
  { id: 20, companyId: 4, name: "City Store" },
];
const ASSIGNEES = [
  { Id: 7, Name: "Ravi Kumar", CompanyId: 2 },
  { Id: 9, Name: "Sara Store", CompanyId: 4 },
];
const LABELS = { activity: "Visit", account: "Account" };

function renderForm() {
  const onSaved = jest.fn();
  render(
    <ActivityFormModal
      activity={null}
      accounts={ACCOUNTS}
      employees={ASSIGNEES}
      labels={LABELS}
      onClose={jest.fn()}
      onSaved={onSaved}
      showToast={jest.fn()}
    />,
  );
  return onSaved;
}

function optionNames(label) {
  return Array.from(screen.getByLabelText(label).options).map((o) => o.textContent);
}

describe("ActivityFormModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads the chosen account's company types and assignees", async () => {
    // Arrange
    const user = userEvent.setup();
    renderForm();

    // Act
    await user.selectOptions(screen.getByLabelText(/^Account/), "20");

    // Assert
    expect(mockUseActivityTypes).toHaveBeenLastCalledWith(4);
    expect(optionNames(/^Type/)).toContain("Store audit");
    expect(optionNames(/^Assign To/)).toEqual(["— Select person —", "Sara Store"]);
  });

  it("creates the activity in the account's company", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true, data: { id: 1 } } });
    const user = userEvent.setup();
    const onSaved = renderForm();

    // Act
    await user.type(screen.getByLabelText(/^Title/), "Audit shelf");
    await user.selectOptions(screen.getByLabelText(/^Account/), "20");
    await user.selectOptions(screen.getByLabelText(/^Assign To/), "9");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    // Assert
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("Visit created."));
    expect(api.post).toHaveBeenCalledWith("/activities", expect.objectContaining({
      activityTypeId: 8, accountId: 20, assignedTo: 9, companyId: 4,
    }));
  });
});
