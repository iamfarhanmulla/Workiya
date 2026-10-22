import {
  render, screen, waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import AccountsPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));

jest.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: jest.fn() }));

jest.mock("@/hooks/useTerminology", () => {
  const labels = { "account.singular": "Doctor", "account.plural": "Doctors" };
  return { useTerminology: () => ({ t: (key) => labels[key] || key, loading: false }) };
});

const mockUseCustomFields = jest.fn(() => ({
  fields: [{
    id: 1, fieldKey: "specialty", label: "Specialty", dataType: "TEXT", isActive: true,
  }],
  loading: false,
}));
jest.mock("@/hooks/useCustomFields", () => ({
  useCustomFields: (...args) => mockUseCustomFields(...args),
}));

jest.mock("@/components/CustomFieldInputs", () => ({ fields, values, onChange }) => (
  fields.map((f) => (
    <label key={f.fieldKey} htmlFor={`extra-${f.fieldKey}`}>
      {f.label}
      <input
        id={`extra-${f.fieldKey}`}
        value={values[f.fieldKey] || ""}
        onChange={(e) => onChange({ ...values, [f.fieldKey]: e.target.value })}
      />
    </label>
  ))
));

jest.mock("@/components/CustomFieldValues", () => ({ values }) => (
  <dl>{Object.entries(values).map(([k, v]) => <dd key={k}>{`${k}=${v}`}</dd>)}</dl>
));

const ACCOUNT = {
  id: 1,
  companyId: 5,
  name: "Dr Meera Shah",
  city: "Mumbai",
  isActive: true,
  // "hospital" belongs to a field that was switched off: it is shown nowhere and never sent.
  extraFields: { specialty: "Cardiology", hospital: "City Hospital" },
  assignedUsers: [{ userId: 11, displayName: "Ravi Kumar", visitsPerMonth: 2 }],
};

function pageOf(items, total = items.length) {
  return {
    data: {
      success: true,
      data: {
        items, total, page: 1, pageSize: 50,
      },
    },
  };
}

function mockGets({ items = [ACCOUNT], total } = {}) {
  api.get.mockImplementation((url) => {
    if (url === "/accounts") return Promise.resolve(pageOf(items, total));
    if (url === "/companies") {
      return Promise.resolve({ data: { success: true, data: [{ Id: 5, Name: "Acme" }] } });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

describe("AccountsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCurrentUser.mockReturnValue({ id: 2, roleCode: "ADMIN" });
  });

  it("uses the terminology label as the page title", async () => {
    // Arrange
    mockGets();

    // Act
    render(<AccountsPage />);

    // Assert
    expect(screen.getByRole("heading", { level: 1, name: "Doctors" })).toBeInTheDocument();
    expect(await screen.findByText("Dr Meera Shah")).toBeInTheDocument();
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add Doctor/ })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/accounts", { params: { page: 1, pageSize: 50 } });
  });

  it("submits the extra fields in the POST body", async () => {
    // Arrange
    mockGets();
    api.post.mockResolvedValue({ data: { success: true, data: { id: 2 } } });
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: /Add Doctor/ }));
    await user.type(screen.getByLabelText(/Doctor Name/), "Dr New");
    await user.type(screen.getByLabelText("Latitude"), "19.5");
    await user.type(screen.getByLabelText("Specialty"), "Neuro");
    await user.click(screen.getByRole("button", { name: /Save Doctor/ }));

    // Assert
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe("/accounts");
    expect(body).toMatchObject({
      name: "Dr New", latitude: 19.5, longitude: null, extraFields: { specialty: "Neuro" },
    });
    expect(body).not.toHaveProperty("companyId");
    expect(await screen.findByText("Doctor created successfully.")).toBeInTheDocument();
  });

  it("shows the server's INVALID_EXTRA_FIELDS message in the form", async () => {
    // Arrange
    mockGets();
    api.put.mockRejectedValue({
      response: {
        status: 400,
        data: { errorCode: "INVALID_EXTRA_FIELDS", message: "Specialty is required." },
      },
    });
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: /Save Doctor/ }));

    // Assert
    expect(await screen.findByRole("alert")).toHaveTextContent("Specialty is required.");
    expect(api.put).toHaveBeenCalledWith("/accounts/1", expect.objectContaining({
      name: "Dr Meera Shah", extraFields: { specialty: "Cardiology" },
    }));
  });

  it("lets a super admin pick the company for a new account", async () => {
    // Arrange
    useCurrentUser.mockReturnValue({ id: 1, roleCode: "SUPER_ADMIN" });
    mockGets();
    api.post.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: /Add Doctor/ }));
    await user.type(screen.getByLabelText(/Doctor Name/), "Dr Co");
    await user.selectOptions(await screen.findByLabelText(/Company/), "5");
    await user.click(screen.getByRole("button", { name: /Save Doctor/ }));

    // Assert
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/accounts",
      expect.objectContaining({ name: "Dr Co", companyId: 5 }),
    ));
    expect(mockUseCustomFields).toHaveBeenCalledWith("ACCOUNT", "5");
  });

  it("gives an EMPLOYEE a read-only page", async () => {
    // Arrange
    useCurrentUser.mockReturnValue({ id: 11, roleCode: "EMPLOYEE" });
    mockGets();
    const user = userEvent.setup();

    // Act
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");
    await user.click(screen.getByRole("button", { name: "View" }));

    // Assert
    expect(screen.queryByRole("button", { name: /Add Doctor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Transfer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign reps" })).not.toBeInTheDocument();
    expect(screen.getByText("specialty=Cardiology")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/companies");
  });

  it("toggles status and deletes through the API", async () => {
    // Arrange
    mockGets();
    api.patch.mockResolvedValue({ data: { success: true } });
    api.delete.mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Yes, Delete/ }));

    // Assert
    expect(api.patch).toHaveBeenCalledWith("/accounts/1/status", { isActive: false });
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/accounts/1"));
    expect(await screen.findByText("Doctor deleted.")).toBeInTheDocument();
  });

  it("pages, searches and filters through query parameters", async () => {
    // Arrange
    mockGets({ total: 120 });
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.selectOptions(screen.getByLabelText("Status filter"), "inactive");
    await user.type(screen.getByLabelText("Search doctors"), "mum");
    await user.click(screen.getByRole("button", { name: "List view" }));

    // Assert
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/accounts", {
      params: { page: 2, pageSize: 50 },
    }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/accounts", {
      params: {
        page: 1, pageSize: 50, search: "mum", isActive: "false",
      },
    }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("opens the edit form from the view panel and toasts a failed status change", async () => {
    // Arrange
    mockGets();
    api.patch.mockRejectedValue({ response: { status: 403, data: { message: "Not allowed." } } });
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    await user.click(screen.getByRole("button", { name: "View" }));
    await user.click(screen.getByRole("button", { name: /Edit Doctor/ }));

    // Assert
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Doctor Name/)).toHaveValue("Dr Meera Shah");
    expect(screen.getByLabelText("City")).toHaveValue("Mumbai");
  });

  it("opens the assign and transfer modals for staff", async () => {
    // Arrange
    mockGets();
    const user = userEvent.setup();
    render(<AccountsPage />);
    await screen.findByText("Dr Meera Shah");

    // Act
    await user.click(screen.getByRole("button", { name: "Assign reps" }));
    const assignTitle = await screen.findByRole("dialog", { name: "Assign reps" });
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: /Transfer Doctors/ }));

    // Assert
    expect(assignTitle).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Transfer Doctors" })).toBeInTheDocument();
  });

  it("reports a failure when the list cannot be loaded", async () => {
    // Arrange
    api.get.mockRejectedValue(new Error("down"));

    // Act
    render(<AccountsPage />);

    // Assert
    expect(await screen.findByText("Failed to load data.")).toBeInTheDocument();
  });
});
