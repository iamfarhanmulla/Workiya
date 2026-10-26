import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import ActivitiesPage from "./page";

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

jest.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: jest.fn() }));

const VISIT_TYPE = {
  id: 3, name: "Visit", requiresCheckIn: true, minPhotos: 0, isActive: true,
};
const mockUseActivityTypes = jest.fn(() => ({
  types: [VISIT_TYPE], loading: false, reload: jest.fn(),
}));
jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: (...args) => mockUseActivityTypes(...args),
}));

const SUBMISSION_FIELDS = [{
  id: 1,
  entityType: "SUBMISSION",
  fieldKey: "samplesGiven",
  label: "Samples given",
  dataType: "TEXT",
  isRequired: false,
  options: null,
  sortOrder: 1,
  isActive: true,
}];

jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({ fields: SUBMISSION_FIELDS, loading: false, reload: jest.fn() }),
}));

const STAFF = { id: 1, roleCode: "MANAGER" };
const REP = { id: 7, roleCode: "EMPLOYEE" };

const ACTIVITY = {
  id: 5,
  companyId: 2,
  activityTypeId: 3,
  activityTypeName: "Visit",
  accountId: 10,
  accountName: "Dr Shah",
  assignedTo: 7,
  assignedToName: "Ravi Kumar",
  title: "Visit Dr Shah",
  status: "Pending",
  priority: "High",
  latestSubmission: null,
};

const SUBMISSION = {
  id: 9,
  activityId: 5,
  reviewStatus: "Pending",
  submittedByName: "Ravi Kumar",
  checkInAtUtc: "2026-10-21T09:00:00.000Z",
  checkInLatitude: 19.07,
  checkInLongitude: 72.87,
  notes: "Met the doctor",
  rating: 4,
  photoUrl: "https://files.example.com/p.jpg",
  answers: { samplesGiven: "Two boxes" },
};

const INACTIVE_REP = { Id: 8, FirstName: "Gone", IsActive: false };
const OTHER_COMPANY_REP = { Id: 12, FirstName: "Other", CompanyId: 4 };

function ok(data) {
  return Promise.resolve({ data: { success: true, data } });
}

function page(items) {
  return ok({
    items, total: items.length, page: 1, pageSize: 200,
  });
}

function mockGets({ activities = [ACTIVITY], submission = SUBMISSION } = {}) {
  api.get.mockImplementation((url) => {
    if (url === "/activities") return page(activities);
    if (url === "/accounts") {
      return page([{
        id: 10, companyId: 2, name: "Dr Shah", city: "Pune",
      }]);
    }
    if (url === "/employees") {
      return ok([{ Id: 7, FirstName: "Ravi", LastName: "Kumar" }, INACTIVE_REP, OTHER_COMPANY_REP]);
    }
    if (url === "/employees/managers-list") return ok([{ Id: 30, Name: "Mona Manager" }]);
    if (url === "/submissions/9") return ok(submission);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

function mockGeolocation(impl) {
  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: jest.fn(impl) },
  });
}

describe("ActivitiesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCurrentUser.mockReturnValue(STAFF);
  });

  it("titles the page with the company's activity terminology", async () => {
    // Arrange
    mockGets();

    // Act
    render(<ActivitiesPage />);

    // Assert
    expect(await screen.findByRole("heading", { name: "Visits" })).toBeInTheDocument();
    expect(await screen.findByText("Visit Dr Shah")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/activities", { params: { page: 1, pageSize: 200 } });
  });

  it("creates an activity with the chosen type, account and assignee", async () => {
    // Arrange
    mockGets({ activities: [] });
    api.post.mockReturnValue(ok({ id: 6 }));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await screen.findByText("Total Visits");

    // Act
    await user.click(screen.getByRole("button", { name: /New Visit/ }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Title/), "Detail new syrup");
    await within(dialog).findByRole("option", { name: "Dr Shah • Pune" });
    await user.selectOptions(within(dialog).getByLabelText(/^Doctor/), "10");
    await within(dialog).findByRole("option", { name: "Mona Manager" });
    const assignees = Array.from(within(dialog).getByLabelText(/^Assign To/).options)
      .map((o) => o.textContent);
    await user.selectOptions(within(dialog).getByLabelText(/^Assign To/), "7");
    await user.click(within(dialog).getByRole("button", { name: /Save/ }));

    // Assert
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("/activities", expect.objectContaining({
      activityTypeId: 3,
      accountId: 10,
      companyId: 2,
      assignedTo: 7,
      title: "Detail new syrup",
      priority: "Medium",
    }));
    expect(await screen.findByText("Visit created.")).toBeInTheDocument();
    // Active accounts only; inactive reps and other companies' reps are not offered, managers are.
    expect(api.get)
      .toHaveBeenCalledWith("/accounts", { params: { pageSize: 200, isActive: "true" } });
    expect(assignees).toEqual(["— Select person —", "Mona Manager", "Ravi Kumar"]);
    expect(mockUseActivityTypes).toHaveBeenLastCalledWith(2);
  });

  it("offers an EMPLOYEE only Start on their own pending activity", async () => {
    // Arrange
    useCurrentUser.mockReturnValue(REP);
    mockGets();

    // Act
    render(<ActivitiesPage />);
    await screen.findByText("Visit Dr Shah");

    // Assert
    expect(screen.getByRole("button", { name: "→ Start" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Completed/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New Visit/ })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/employees");
  });

  it("lets an EMPLOYEE submit a report with answers and check-in coordinates", async () => {
    // Arrange
    useCurrentUser.mockReturnValue(REP);
    mockGets();
    mockGeolocation((success) => success({ coords: { latitude: 19.0761, longitude: 72.8775 } }));
    api.post.mockReturnValue(ok({ id: 11 }));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await user.click(await screen.findByRole("button", { name: "View" }));

    // Act
    await user.click(screen.getByRole("button", { name: /Submit report/ }));
    await user.click(screen.getByRole("button", { name: /Use my location/ }));
    await user.type(screen.getByLabelText("Notes"), "Doctor agreed to trial");
    await user.type(screen.getByLabelText("Samples given"), "Two boxes");
    await user.click(screen.getByRole("button", { name: /^Submit$/ }));

    // Assert
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post).toHaveBeenCalledWith("/activities/5/submissions", expect.objectContaining({
      checkInLatitude: 19.0761,
      checkInLongitude: 72.8775,
      checkInAtUtc: expect.any(String),
      notes: "Doctor agreed to trial",
      answers: { samplesGiven: "Two boxes" },
    }));
  });

  it("shows a clear message when location permission is denied", async () => {
    // Arrange
    useCurrentUser.mockReturnValue(REP);
    mockGets();
    mockGeolocation((_success, failure) => failure({ code: 1 }));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    await user.click(screen.getByRole("button", { name: /Submit report/ }));

    // Act
    await user.click(screen.getByRole("button", { name: /Use my location/ }));

    // Assert
    expect(screen.getByRole("alert")).toHaveTextContent("Location permission was denied");
  });

  it("shows the server's geofence message when the report is rejected", async () => {
    // Arrange
    useCurrentUser.mockReturnValue(REP);
    mockGets();
    mockGeolocation((success) => success({ coords: { latitude: 18.5, longitude: 73.8 } }));
    api.post.mockReturnValue(Promise.reject(Object.assign(new Error("422"), {
      response: { data: { errorCode: "OUTSIDE_GEOFENCE", message: "You are 812 m away." } },
    })));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await user.click(await screen.findByRole("button", { name: "View" }));
    await user.click(screen.getByRole("button", { name: /Submit report/ }));
    await user.click(screen.getByRole("button", { name: /Use my location/ }));

    // Act
    await user.click(screen.getByRole("button", { name: /^Submit$/ }));

    // Assert
    expect(await screen.findByText("You are 812 m away.")).toBeInTheDocument();
  });

  it("lets staff approve a pending report", async () => {
    // Arrange
    const reported = {
      ...ACTIVITY,
      status: "Completed",
      latestSubmission: { id: 9, reviewStatus: "Pending", submittedAtUtc: "2026-10-21T10:00:00Z" },
    };
    mockGets({ activities: [reported] });
    api.patch.mockReturnValue(ok({ ...SUBMISSION, reviewStatus: "Approved" }));
    const user = userEvent.setup();
    render(<ActivitiesPage />);
    await user.click(await screen.findByRole("button", { name: "View" }));

    // Act
    expect(await screen.findByText("Two boxes")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Review comment"), "Good visit");
    await user.click(screen.getByRole("button", { name: /Approve/ }));

    // Assert
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
      "/submissions/9/review",
      { status: "Approved", comment: "Good visit" },
    ));
    expect(await screen.findByText("Report approved.")).toBeInTheDocument();
  });

  it("reports a failure when the activities cannot be loaded", async () => {
    // Arrange
    api.get.mockImplementation((url) => (url === "/activities"
      ? Promise.reject(new Error("boom"))
      : page([])));

    // Act
    render(<ActivitiesPage />);

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load visits.");
  });
});
