import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import ActivitiesPage from "../page";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

const LABELS = {
  "activity.singular": "Visit",
  "activity.plural": "Visits",
  "account.singular": "Doctor",
  "submission.singular": "Visit Report",
  "submission.plural": "Visit Reports",
};

jest.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({ t: (key) => LABELS[key] || key, loading: false, reload: jest.fn() }),
}));

jest.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => ({ id: 1, roleCode: "ADMIN" }),
}));

jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: () => ({
    types: [{ id: 3, name: "Visit", isActive: true }, { id: 4, name: "Call", isActive: true }],
    loading: false,
    reload: jest.fn(),
  }),
}));

jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({ fields: [], loading: false, reload: jest.fn() }),
}));

const ACTIVITY = {
  id: 5,
  activityTypeId: 4,
  activityTypeName: "Call",
  accountId: 10,
  accountName: "Dr Shah",
  assignedTo: 7,
  assignedToName: "Ravi Kumar",
  title: "Visit Dr Shah",
  description: "Bring samples",
  status: "Pending",
  priority: "Low",
  dueAtUtc: "2020-01-01T10:00:00.000Z",
  latestSubmission: null,
};

const PENDING = {
  id: 9,
  activityTitle: "Visit Dr Shah",
  accountName: "Dr Shah",
  submittedByName: "Ravi Kumar",
  submittedAtUtc: "2026-10-21T10:00:00Z",
  reviewStatus: "Pending",
};

function ok(data) {
  return Promise.resolve({ data: { success: true, data } });
}

function page(items) {
  return ok({
    items, total: items.length, page: 1, pageSize: 200,
  });
}

function mockGets() {
  api.get.mockImplementation((url) => {
    if (url === "/activities") return page([ACTIVITY]);
    if (url === "/accounts") return page([{ id: 10, name: "Dr Shah" }]);
    if (url === "/employees") return ok([{ Id: 7, FirstName: "Ravi", LastName: "Kumar" }]);
    if (url === "/submissions") return page([PENDING]);
    if (url === "/submissions/9") return ok(PENDING);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe("ActivitiesPage staff flows", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGets();
  });

  it("moves an activity to another status", async () => {
    // Arrange
    api.patch.mockReturnValue(ok({ ...ACTIVITY, status: "InProgress" }));
    const user = userEvent.setup();
    render(<ActivitiesPage />);

    // Act
    await user.click(await screen.findByRole("button", { name: "→ IN PROGRESS" }));

    // Assert
    expect(api.patch).toHaveBeenCalledWith("/activities/5/status", { status: "InProgress" });
    expect(await screen.findByText("Visit moved to in progress.")).toBeInTheDocument();
  });

  it("shows the server message when a status change fails", async () => {
    // Arrange
    api.patch.mockReturnValue(Promise.reject(Object.assign(new Error("422"), {
      response: { data: { message: "Not allowed." } },
    })));
    const user = userEvent.setup();
    render(<ActivitiesPage />);

    // Act
    await user.click(await screen.findByRole("button", { name: "→ MISSED" }));

    // Assert
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
  });

  it("deletes an activity after confirmation", async () => {
    // Arrange
    api.delete.mockReturnValue(ok(null));
    const user = userEvent.setup();
    render(<ActivitiesPage />);

    // Act
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Yes, Delete/ }));

    // Assert
    expect(api.delete).toHaveBeenCalledWith("/activities/5");
    expect(await screen.findByText("Visit deleted.")).toBeInTheDocument();
  });

  it("edits an activity with PUT and keeps its existing values", async () => {
    // Arrange
    api.put.mockReturnValue(ok(ACTIVITY));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = screen.getByRole("dialog");

    // Act
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "High");
    await user.click(within(dialog).getByRole("button", { name: /Save/ }));

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalledTimes(1));
    expect(api.put).toHaveBeenCalledWith("/activities/5", expect.objectContaining({
      activityTypeId: 4,
      accountId: 10,
      assignedTo: 7,
      priority: "High",
      description: "Bring samples",
      dueAtUtc: "2020-01-01T10:00:00.000Z",
    }));
  });

  it("asks for a type when several types exist and none is chosen", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await screen.findByText("Visit Dr Shah");

    // Act
    await user.click(screen.getByRole("button", { name: /New Visit/ }));
    await user.type(screen.getByLabelText(/^Title/), "Call back");
    await user.click(screen.getByRole("button", { name: /Save/ }));

    // Assert
    expect(await screen.findByText("Please select a type.")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows activities in the list view", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await screen.findByText("Visit Dr Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "List" }));

    // Assert
    const table = screen.getByRole("table");
    expect(within(table).getByText("Visit Dr Shah")).toBeInTheDocument();
    expect(within(table).getByText("Bring samples")).toBeInTheDocument();
  });

  it("rejects a report from the pending review queue", async () => {
    // Arrange
    api.patch.mockReturnValue(ok({ ...PENDING, reviewStatus: "Rejected" }));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await screen.findByText("Visit Dr Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "Pending review" }));
    await user.click(await screen.findByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: /Reject/ }));

    // Assert
    expect(api.get).toHaveBeenCalledWith("/submissions", {
      params: { reviewStatus: "Pending", pageSize: 200 },
    });
    expect(api.patch).toHaveBeenCalledWith("/submissions/9/review", {
      status: "Rejected", comment: null,
    });
    expect(await screen.findByText("Report rejected.")).toBeInTheDocument();
  });

  it("sends the status filter and search to the server", async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await screen.findByText("Visit Dr Shah");

    // Act
    await user.selectOptions(screen.getByLabelText("Status"), "Pending");
    await user.type(screen.getByLabelText("Search visits"), "shah");

    // Assert
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/activities", {
      params: {
        page: 1, pageSize: 200, status: "Pending", search: "shah",
      },
    }));
  });
});
