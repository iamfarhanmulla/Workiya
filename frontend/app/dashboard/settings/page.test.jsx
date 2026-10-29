import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import SettingsPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

jest.mock("@/hooks/useCurrentUser", () => ({
  ...jest.requireActual("@/hooks/useCurrentUser"),
  useCurrentUser: jest.fn(),
}));

const mockReloadTerms = jest.fn();
const mockReloadFields = jest.fn();
const mockReloadTypes = jest.fn();
const LABELS = {
  "account.singular": "Doctor",
  "account.plural": "Doctors",
  "activity.singular": "Visit",
  "activity.plural": "Visits",
  "submission.singular": "Report",
  "submission.plural": "Reports",
  "rep.singular": "MR",
  "rep.plural": "MRs",
};

jest.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({
    t: (key) => LABELS[key], loading: false, reload: mockReloadTerms,
  }),
}));
jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({ fields: [], loading: false, reload: mockReloadFields }),
}));
jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: () => ({ types: [], loading: false, reload: mockReloadTypes }),
}));

const FIELD = {
  id: 4,
  entityType: "ACCOUNT",
  fieldKey: "speciality",
  label: "Speciality",
  dataType: "SELECT",
  isRequired: true,
  options: ["Cardio", "Neuro"],
  sortOrder: 1,
  isActive: true,
};
const TYPE = {
  id: 9,
  code: "DOCTOR_VISIT",
  name: "Doctor visit",
  requiresCheckIn: true,
  geofenceMeters: 200,
  minPhotos: 1,
  requiresSignature: false,
  requiresCustomerOtp: false,
  isActive: true,
};

function wrap(data) {
  return Promise.resolve({ data: { success: true, data } });
}

function mockApi() {
  api.get.mockImplementation((url) => {
    if (url === "/settings/terminology") return wrap(LABELS);
    if (url === "/settings/custom-fields") return wrap([FIELD]);
    if (url === "/settings/activity-types") return wrap([TYPE]);
    if (url === "/companies") return wrap([{ Id: 3, Name: "Acme Pharma" }]);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  api.put.mockImplementation(() => wrap({}));
  api.post.mockImplementation(() => wrap({ id: 50 }));
  api.delete.mockImplementation(() => wrap(null));
}

function renderAs(roleCode) {
  useCurrentUser.mockReturnValue({
    id: 1, roleCode, firstName: "Asha", lastName: "Rao", email: "asha@example.com",
  });
  return render(<SettingsPage />);
}

describe("SettingsPage — Fields & Labels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it("shows the Labels section to an ADMIN, prefilled from the API", async () => {
    // Arrange / Act
    renderAs("ADMIN");

    // Assert
    const termInput = await screen.findByDisplayValue("Doctor");
    expect(termInput).toHaveAttribute("id", "stg-term-account-singular");
    expect(screen.getByRole("heading", { name: "Labels" })).toBeInTheDocument();
    expect(screen.getByText("Doctor fields")).toBeInTheDocument();
    expect(screen.getByText("Report questions")).toBeInTheDocument();
    expect(await screen.findByText("Speciality")).toBeInTheDocument();
    expect(await screen.findByText("Doctor visit")).toBeInTheDocument();
  });

  it("hides the Fields & Labels sections from an EMPLOYEE", () => {
    // Arrange / Act
    renderAs("EMPLOYEE");

    // Assert
    expect(screen.getByText("Company settings are managed by your admin")).toBeInTheDocument();
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();
    expect(screen.queryByText("Visit types")).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("saves all eight labels with PUT and reloads the terminology", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");
    const input = await screen.findByDisplayValue("Doctor");

    // Act
    await user.clear(input);
    await user.type(input, "Clinic");
    await user.click(screen.getByRole("button", { name: /save labels/i }));

    // Assert
    await waitFor(() => expect(mockReloadTerms).toHaveBeenCalled());
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe("/settings/terminology");
    expect(Object.keys(body.labels).sort()).toEqual(Object.keys(LABELS).sort());
    expect(body.labels["account.singular"]).toBe("Clinic");
    expect(await screen.findByText("Labels saved.")).toBeInTheDocument();
  });

  it("blocks saving when a label is empty", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");
    const input = await screen.findByDisplayValue("Visits");

    // Act
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: /save labels/i }));

    // Assert
    expect(await screen.findByText(/every label is required/i)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("creates a SELECT field with an options array and an auto-generated key", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");
    await screen.findByText("Speciality");

    // Act
    await user.click(screen.getByRole("button", { name: /add doctor field/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^label/i), "Hospital Name");
    await user.selectOptions(within(dialog).getByLabelText("Data type"), "SELECT");
    await user.type(within(dialog).getByLabelText(/options/i), "City, Apollo , City");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe("/settings/custom-fields");
    expect(body).toMatchObject({
      entityType: "ACCOUNT",
      fieldKey: "hospitalName",
      label: "Hospital Name",
      dataType: "SELECT",
      options: ["City", "Apollo"],
      isRequired: false,
      sortOrder: 0,
    });
    expect(body.companyId).toBeUndefined();
    expect(mockReloadFields).toHaveBeenCalled();
  });

  it("edits a field without sending its immutable key or type", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");

    // Act
    await user.click(await screen.findByRole("button", { name: "Edit Speciality" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/field key/i)).toBeDisabled();
    await user.click(within(dialog).getByLabelText("Required"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe("/settings/custom-fields/4");
    expect(body).toEqual({
      label: "Speciality",
      isRequired: false,
      options: ["Cardio", "Neuro"],
      sortOrder: 1,
      isActive: true,
    });
  });

  it("soft-deletes a field after confirmation", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");

    // Act
    await user.click(await screen.findByRole("button", { name: "Delete Speciality" }));
    await user.click(screen.getByRole("button", { name: /yes, delete/i }));

    // Assert
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(
      "/settings/custom-fields/4",
      { params: {} },
    ));
    expect(mockReloadFields).toHaveBeenCalled();
  });
});
