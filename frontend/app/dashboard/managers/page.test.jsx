import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import ManagersPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  ...jest.requireActual("@/lib/apiClient"),
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
}));

const ok = (data) => Promise.resolve({ data: { success: true, data } });

function manager(id, firstName, email, extra) {
  return {
    Id: id, FirstName: firstName, LastName: "Shah", Email: email, CompanyId: 5, ...extra,
  };
}

const MANAGERS = [
  manager(1, "Venkat", "venkat@x.in", { IsActive: true, EmployeeCount: 4, TaskCount: 9 }),
  manager(2, "Rekha", "rekha@x.in", { IsActive: false, EmployeeCount: 2, CompanyId: 6 }),
];

function mockGets({ managers = ok(MANAGERS) } = {}) {
  api.get.mockImplementation((path) => {
    if (path === "/managers") return managers;
    if (path === "/users/companies") {
      return ok([{ Id: 5, Name: "Sunrise" }, { Id: 6, Name: "Nexa" }]);
    }
    return Promise.reject(new Error(path));
  });
}

async function renderPage() {
  const user = userEvent.setup();
  render(<ManagersPage />);
  await screen.findByText("venkat@x.in");
  return user;
}

const rowOf = (email) => screen.getByText(email).closest("tr");

describe("ManagersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGets();
  });

  it("shows totals and filters by status", async () => {
    // Arrange
    const user = await renderPage();

    // Act
    await user.selectOptions(screen.getByLabelText("Status filter"), "Inactive");

    // Assert
    expect(screen.getByText("Employees led").parentElement).toHaveTextContent("6");
    expect(screen.queryByText("venkat@x.in")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 managers")).toBeInTheDocument();
  });

  it("requires a password for a new manager, then creates it", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Add manager" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/^Email address/), "new@x.in");

    // Act
    await user.click(dialog.getByRole("button", { name: /Add manager/ }));
    const firstError = await screen.findByRole("alert");
    await user.type(dialog.getByLabelText(/^Password/), "Secret#123");
    await user.click(dialog.getByRole("button", { name: /Add manager/ }));

    // Assert
    expect(firstError).toHaveTextContent("Password is required for new manager.");
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/managers",
      expect.objectContaining({ email: "new@x.in", password: "Secret#123", isActive: 1 }),
    ));
    expect(await screen.findByText("Manager created successfully!")).toBeInTheDocument();
  });

  it("opens the details and edits without sending a blank password", async () => {
    // Arrange
    api.put.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("venkat@x.in")).getByRole("button", { name: "View" }));
    const details = within(screen.getByRole("dialog", { name: "Manager details" }));
    const teamSize = details.getByText("Employees").nextSibling.textContent;
    await user.click(details.getByRole("button", { name: /Edit manager/ }));
    await user.click(screen.getByRole("button", { name: /Update manager/ }));

    // Assert
    expect(teamSize).toBe("4");
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe("/managers/1");
    expect(body).not.toHaveProperty("password");
  });

  it("deactivates an active manager", async () => {
    // Arrange
    api.patch.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("venkat@x.in")).getByRole("button", { name: "Deactivate" }));

    // Assert
    expect(api.patch).toHaveBeenCalledWith("/managers/1/status", { isActive: 0 });
    expect(await screen.findByText("Manager deactivated.")).toBeInTheDocument();
  });

  it("deletes after confirmation and reports a failure", async () => {
    // Arrange
    api.delete.mockRejectedValue(new Error("500"));
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("rekha@x.in")).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Yes, Delete/ }));

    // Assert
    expect(api.delete).toHaveBeenCalledWith("/managers/2");
    expect(await screen.findByText("Failed to delete manager.")).toBeInTheDocument();
  });

  it("shows a retry when the list fails to load", async () => {
    // Arrange
    mockGets({ managers: Promise.resolve({ data: { success: false } }) });

    // Act
    render(<ManagersPage />);

    // Assert
    expect(await screen.findByText(/Couldn't load managers/)).toBeInTheDocument();
    expect(screen.queryByText(/Cannot connect/)).not.toBeInTheDocument();
  });
});
