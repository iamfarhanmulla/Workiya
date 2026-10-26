import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import EmployeesPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  ...jest.requireActual("@/lib/apiClient"),
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
}));

const ok = (data) => Promise.resolve({ data: { success: true, data } });

const EMPLOYEES = [
  {
    Id: 1,
    FirstName: "Asha",
    LastName: "Rao",
    Email: "asha@x.in",
    CompanyId: 5,
    CompanyName: "Sunrise Pharma",
    TaskCount: 4,
    TaskDone: 4,
    IsActive: true,
  },
  {
    Id: 2,
    FirstName: "Ravi",
    LastName: "Kumar",
    Email: "ravi@x.in",
    CompanyId: 6,
    CompanyName: "Moonlight Labs",
    ManagerId: 9,
    ManagerName: "Meena Iyer",
    TaskCount: 3,
    TaskDone: 1,
    IsActive: false,
  },
];
const COMPANIES = [{ Id: 5, Name: "Sunrise Pharma" }, { Id: 6, Name: "Moonlight Labs" }];
const MANAGERS = [{ Id: 9, Name: "Meena Iyer", CompanyName: "Moonlight Labs" }];

function mockGets({ employees = ok(EMPLOYEES) } = {}) {
  api.get.mockImplementation((path) => {
    if (path === "/employees") return employees;
    if (path === "/users/companies") return ok(COMPANIES);
    if (path === "/employees/managers-list") return ok(MANAGERS);
    return Promise.reject(new Error(path));
  });
}

async function renderPage() {
  const user = userEvent.setup();
  render(<EmployeesPage />);
  await screen.findByText("ravi@x.in");
  return user;
}

const rowOf = (email) => within(screen.getByText(email).closest("tr"));

describe("EmployeesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGets();
  });

  it("lists employees with totals and filters them by company and status", async () => {
    // Arrange
    const user = await renderPage();

    // Act
    await user.selectOptions(screen.getByLabelText("Company filter"), "6");
    const afterCompany = screen.getByText("Showing 1 of 2 employees");
    await user.selectOptions(screen.getByLabelText("Company filter"), "All");
    await user.selectOptions(screen.getByLabelText("Status filter"), "Active");

    // Assert
    expect(afterCompany).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Asha Rao")).toBeInTheDocument();
    expect(within(table).queryByText("ravi@x.in")).not.toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("asks for a password when adding, then creates the employee", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Add employee" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/^Email address/), "new@x.in");
    await user.selectOptions(dialog.getByLabelText("Manager"), "9");

    // Act
    await user.click(dialog.getByRole("button", { name: /Add employee/ }));
    const firstError = await screen.findByRole("alert");
    await user.type(dialog.getByLabelText(/^Password/), "Secret#123");
    await user.click(dialog.getByRole("button", { name: /Add employee/ }));

    // Assert
    expect(firstError).toHaveTextContent("Password is required for new employee.");
    const expected = expect.objectContaining({
      email: "new@x.in", managerId: "9", password: "Secret#123", isActive: 1,
    });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/employees", expected));
    expect(await screen.findByText("Employee created successfully!")).toBeInTheDocument();
  });

  it("keeps the current password when editing from the view dialog", async () => {
    // Arrange
    api.put.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    await user.click(rowOf("ravi@x.in").getByRole("button", { name: "View" }));
    const view = within(screen.getByRole("dialog"));
    expect(view.getByText("1 / 3 completed")).toBeInTheDocument();

    // Act
    await user.click(view.getByRole("button", { name: /Edit employee/ }));
    await user.click(screen.getByRole("button", { name: /Update employee/ }));

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe("/employees/2");
    expect(body).not.toHaveProperty("password");
    expect(body).toMatchObject({ email: "ravi@x.in", managerId: 9, isActive: 0 });
    expect(await screen.findByText("Employee updated successfully!")).toBeInTheDocument();
  });

  it("deactivates an active employee from the row", async () => {
    // Arrange
    api.patch.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(rowOf("asha@x.in").getByRole("button", { name: "Deactivate" }));

    // Assert
    expect(api.patch).toHaveBeenCalledWith("/employees/1/status", { isActive: 0 });
    expect(await screen.findByText("Employee deactivated.")).toBeInTheDocument();
    expect(rowOf("ravi@x.in").getByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("deletes an employee after confirmation", async () => {
    // Arrange
    api.delete.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(rowOf("asha@x.in").getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Yes, Delete/ }));

    // Assert
    expect(api.delete).toHaveBeenCalledWith("/employees/1");
    expect(await screen.findByText("Employee deleted successfully!")).toBeInTheDocument();
  });

  it("shows a connection error with a retry when the list cannot load", async () => {
    // Arrange
    mockGets({ employees: Promise.reject(new Error("offline")) });

    // Act
    render(<EmployeesPage />);

    // Assert
    expect(await screen.findByText(/Couldn't load employees/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot connect to server/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
