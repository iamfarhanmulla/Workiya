import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import CompaniesPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  ...jest.requireActual("@/lib/apiClient"),
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
}));

const ok = (data) => Promise.resolve({ data: { success: true, data } });

const COMPANIES = [
  {
    Id: 1,
    Name: "Sunrise Pharma",
    Key: "sunrise-pharma",
    ContactEmail: "hello@sunrise.in",
    City: "Pune",
    Country: "India",
    Plan: "ENTERPRISE",
    IsActive: true,
    TotalUsers: 12,
    CreatedAtUtc: "2026-10-01T10:00:00Z",
  },
  {
    Id: 2,
    Name: "Blue Labs",
    Key: "blue-labs",
    City: "Berlin",
    Country: "Germany",
    Plan: "STARTUP",
    IsActive: false,
    TotalUsers: 3,
  },
];

async function renderPage() {
  const user = userEvent.setup();
  render(<CompaniesPage />);
  await screen.findByText("Berlin, Germany");
  return user;
}

const rowOf = (name) => within(screen.getByRole("table")).getByText(name).closest("tr");

describe("CompaniesPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockImplementation(() => ok(COMPANIES));
  });

  it("lists companies with totals and filters them by plan", async () => {
    // Arrange
    const user = await renderPage();

    // Act
    await user.selectOptions(screen.getByLabelText("Plan filter"), "STARTUP");

    // Assert
    expect(api.get).toHaveBeenCalledWith("/companies");
    const table = screen.getByRole("table");
    expect(within(table).getByText("Blue Labs")).toBeInTheDocument();
    expect(within(table).queryByText("Sunrise Pharma")).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 companies")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("asks for a name when adding, then creates the company", async () => {
    // Arrange
    api.post.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();
    await user.click(screen.getByRole("button", { name: "Add company" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.type(dialog.getByLabelText(/^City/), "Mumbai");

    // Act
    await user.click(dialog.getByRole("button", { name: /Add company/ }));
    const firstError = await screen.findByRole("alert");
    await user.type(dialog.getByLabelText(/^Company name/), "Acme Corp");
    await user.selectOptions(dialog.getByLabelText(/^Plan/), "PROFESSIONAL");
    await user.click(dialog.getByRole("button", { name: /Add company/ }));

    // Assert
    expect(firstError).toHaveTextContent("Company name is required.");
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/companies", {
      name: "Acme Corp",
      key: "",
      contactEmail: "",
      contactPhone: "",
      address: "",
      city: "Mumbai",
      country: "",
      plan: "PROFESSIONAL",
      isActive: 1,
    }));
    expect(await screen.findByText("Company created successfully!")).toBeInTheDocument();
  });

  it("updates a company from the edit dialog", async () => {
    // Arrange
    api.put.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("Blue Labs")).getByRole("button", { name: "Edit" }));
    const dialog = within(screen.getByRole("dialog"));
    await user.selectOptions(dialog.getByLabelText(/^Status/), "1");
    await user.click(dialog.getByRole("button", { name: /Update company/ }));

    // Assert
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const [path, body] = api.put.mock.calls[0];
    expect(path).toBe("/companies/2");
    expect(body).toMatchObject({
      name: "Blue Labs", key: "blue-labs", city: "Berlin", plan: "STARTUP", isActive: 1,
    });
    expect(await screen.findByText("Company updated successfully!")).toBeInTheDocument();
  });

  it("opens the details view and moves on to editing", async () => {
    // Arrange
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("Sunrise Pharma")).getByRole("button", { name: "View" }));
    const details = within(screen.getByRole("dialog"));
    const email = details.getByText("hello@sunrise.in").closest("div");
    await user.click(details.getByRole("button", { name: /Edit company/ }));

    // Assert
    expect(email).toHaveTextContent("Contact email");
    expect(screen.queryByText("hello@sunrise.in")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Edit company" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Company name/)).toHaveValue("Sunrise Pharma");
  });

  it("deactivates an active company", async () => {
    // Arrange
    api.patch.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("Sunrise Pharma")).getByRole("button", { name: "Deactivate" }));

    // Assert
    expect(api.patch).toHaveBeenCalledWith("/companies/1/status", { isActive: 0 });
    expect(await screen.findByText("Company deactivated.")).toBeInTheDocument();
  });

  it("deletes a company after confirmation", async () => {
    // Arrange
    api.delete.mockResolvedValue({ data: { success: true } });
    const user = await renderPage();

    // Act
    await user.click(within(rowOf("Blue Labs")).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: /Yes, Delete/ }));

    // Assert
    expect(api.delete).toHaveBeenCalledWith("/companies/2");
    expect(await screen.findByText("Company deleted successfully!")).toBeInTheDocument();
  });

  it("shows a connection error with a retry when the list cannot load", async () => {
    // Arrange
    api.get.mockImplementation(() => Promise.reject(new Error("offline")));

    // Act
    render(<CompaniesPage />);

    // Assert
    expect(await screen.findByText(/Couldn't load companies/)).toBeInTheDocument();
    expect(screen.getByText(/Cannot connect to server/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
