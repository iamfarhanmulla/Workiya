import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import FieldsAndLabels from "./FieldsAndLabels";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
  },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

jest.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: jest.fn() }));

const mockReloadTypes = jest.fn();
const mockUseActivityTypes = jest.fn(() => ({
  types: [], loading: false, reload: mockReloadTypes,
}));
jest.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({
    t: (key) => ({ "activity.singular": "Visit", "activity.plural": "Visits" }[key] || key),
    loading: false,
    reload: jest.fn(),
  }),
}));
jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: () => ({ fields: [], loading: false, reload: jest.fn() }),
}));
jest.mock("@/hooks/useActivityTypes", () => ({
  useActivityTypes: (...args) => mockUseActivityTypes(...args),
}));

const TYPE = {
  id: 9,
  code: "DOCTOR_VISIT",
  name: "Doctor visit",
  requiresCheckIn: true,
  geofenceMeters: null,
  minPhotos: 0,
  requiresSignature: false,
  requiresCustomerOtp: false,
  isActive: true,
};

function wrap(data) {
  return Promise.resolve({ data: { success: true, data } });
}

function mockApi() {
  api.get.mockImplementation((url) => {
    if (url === "/companies") return wrap([{ Id: 3, Name: "Acme Pharma" }]);
    if (url === "/settings/terminology") return wrap({});
    if (url === "/settings/custom-fields") return wrap([]);
    if (url === "/settings/activity-types") return wrap([TYPE]);
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  api.post.mockImplementation(() => wrap({ id: 10 }));
  api.put.mockImplementation(() => wrap({}));
}

function renderAs(roleCode) {
  useCurrentUser.mockReturnValue({ id: 1, roleCode });
  return render(<FieldsAndLabels />);
}

async function openAddVisitType(user) {
  await screen.findByText("Doctor visit");
  await user.click(screen.getByRole("button", { name: /add visit type/i }));
  return screen.getByRole("dialog");
}

describe("FieldsAndLabels", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it("renders nothing for a MANAGER", () => {
    // Arrange / Act
    const { container } = renderAs("MANAGER");

    // Assert
    expect(container).toBeEmptyDOMElement();
  });

  it("makes a SUPER_ADMIN pick a company and then passes companyId", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("SUPER_ADMIN");
    await screen.findByRole("option", { name: "Acme Pharma" });
    expect(screen.queryByText("Labels")).not.toBeInTheDocument();

    // Act
    await user.selectOptions(screen.getByLabelText("Company"), "3");
    const dialog = await openAddVisitType(user);
    await user.type(within(dialog).getByLabelText(/^name/i), "Chemist visit");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Assert
    expect(api.get).toHaveBeenCalledWith("/settings/terminology", { params: { companyId: 3 } });
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body, cfg] = api.post.mock.calls[0];
    expect(url).toBe("/settings/activity-types");
    expect(body).toMatchObject({ code: "CHEMIST_VISIT", companyId: 3, geofenceMeters: null });
    expect(cfg).toEqual({ params: { companyId: 3 } });
    expect(mockReloadTypes).toHaveBeenCalled();
    expect(mockUseActivityTypes).toHaveBeenCalledWith(3);
  });

  it("allows at most one photo and offers no customer OTP rule", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");
    const dialog = await openAddVisitType(user);

    // Act
    await user.type(within(dialog).getByLabelText(/^name/i), "Store audit");
    await user.clear(within(dialog).getByLabelText(/minimum photos/i));
    await user.type(within(dialog).getByLabelText(/minimum photos/i), "2");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Assert
    expect(await screen.findByText("Minimum photos must be 0 or 1.")).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/customer OTP/i)).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("rejects a geofence outside 10..5000 metres", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");
    const dialog = await openAddVisitType(user);

    // Act
    await user.type(within(dialog).getByLabelText(/^name/i), "Store audit");
    await user.type(within(dialog).getByLabelText(/geofence/i), "5");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Assert
    expect(await screen.findByText(/between 10 and 5000/i)).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("updates a visit type and keeps a code the user typed", async () => {
    // Arrange
    const user = userEvent.setup();
    renderAs("ADMIN");

    // Act
    await user.click(await screen.findByRole("button", { name: "Edit Doctor visit" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText(/geofence/i), "250");
    await user.click(within(dialog).getByLabelText("Requires signature"));
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [url, body] = api.put.mock.calls[0];
    expect(url).toBe("/settings/activity-types/9");
    expect(body).toMatchObject({
      code: "DOCTOR_VISIT", geofenceMeters: 250, requiresSignature: true,
    });
  });

  it("shows the server message when a visit type in use cannot be deleted", async () => {
    // Arrange
    const user = userEvent.setup();
    api.delete.mockRejectedValue({
      response: { status: 409, data: { message: "Visit type is in use." } },
    });
    renderAs("ADMIN");

    // Act
    await user.click(await screen.findByRole("button", { name: "Delete Doctor visit" }));
    await user.click(screen.getByRole("button", { name: /yes, delete/i }));

    // Assert
    expect(await screen.findByText("Visit type is in use.")).toBeInTheDocument();
    expect(mockReloadTypes).not.toHaveBeenCalled();
  });
});
