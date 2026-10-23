import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import UsersPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  ...jest.requireActual("@/lib/apiClient"),
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(),
  },
}));

const ok = (data) => Promise.resolve({ data: { success: true, data } });

const USERS = [
  {
    Id: 1,
    FirstName: "Asha",
    LastName: "Rao",
    Email: "asha@x.in",
    RoleId: 2,
    RoleName: "Manager",
    CompanyId: 5,
    CompanyName: "Sunrise Pharma",
    IsActive: true,
  },
  {
    Id: 2,
    FirstName: "Ravi",
    LastName: "Kumar",
    Email: "ravi@x.in",
    RoleId: 3,
    RoleName: "Employee",
    CompanyId: 5,
    ManagerId: 1,
    ManagerName: "Asha Rao",
    IsActive: false,
  },
];
const ROLES = [{ Id: 2, Name: "Manager" }, { Id: 3, Name: "Employee" }];
const COMPANIES = [{ Id: 5, Name: "Sunrise Pharma", City: "Pune" }];

function mockGets({ users = ok(USERS) } = {}) {
  api.get.mockImplementation((path) => {
    if (path === "/users") return users;
    if (path === "/users/roles") return ok(ROLES);
    if (path === "/users/companies") return ok(COMPANIES);
    return Promise.reject(new Error(path));
  });
}

async function renderPage() {
  const user = userEvent.setup();
  render(<UsersPage />);
  await screen.findByText("ravi@x.in");
  return user;
}

describe("UsersPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGets();
  });

  it("lists users with totals and filters them by role", async () => {
    // Arrange
    const user = await renderPage();

    // Act
    await user.selectOptions(screen.getByLabelText("Role filter"), "Employee");

    // Assert
    const table = screen.getByRole("table");
    expect(within(table).getByText("Ravi Kumar")).toBeInTheDocument();
    expect(within(table).queryByText("asha@x.in")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 users")).toBeInTheDocument();
  });

  it("asks for a password when adding, then creates the user", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Add user" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/^Email address/), "new@x.in");
    await user.selectOptions(dialog.getByLabelText(/^Role/), "3");

    // Act
    await user.click(dialog.getByRole("button", { name: /Add user/ }));
    const firstError = await screen.findByRole("alert");
    await user.type(dialog.getByLabelText(/^Password/), "Secret#123");
    await user.click(dialog.getByRole("button", { name: /Add user/ }));

    // Assert
    expect(firstError).toHaveTextContent("Password is required.");
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/users", expect.objectContaining({
      email: "new@x.in", roleId: "3", password: "Secret#123",
    })));
    expect(await screen.findByText("User created successfully!")).toBeInTheDocument();
  });

  it("keeps the current password when editing with the field left blank", async () => {
    // Arrange
    api.put.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    const row = screen.getByText("ravi@x.in").closest("tr");

    // Act
    await user.click(within(row).getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: /Update user/ }));

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe("/users/2");
    expect(body).not.toHaveProperty("password");
    expect(body).toMatchObject({ email: "ravi@x.in", isActive: 0 });
  });

  it("deletes a user after confirmation", async () => {
    // Arrange
    api.delete.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    const row = screen.getByText("asha@x.in").closest("tr");

    // Act
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Yes, Delete/ }));

    // Assert
    expect(api.delete).toHaveBeenCalledWith("/users/1");
    expect(await screen.findByText("User deleted successfully!")).toBeInTheDocument();
  });

  it("shows a connection error with a retry when the list cannot load", async () => {
    // Arrange
    mockGets({ users: Promise.reject(new Error("offline")) });

    // Act
    render(<UsersPage />);

    // Assert
    expect(await screen.findByText(/Couldn't load users/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot connect to server/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
