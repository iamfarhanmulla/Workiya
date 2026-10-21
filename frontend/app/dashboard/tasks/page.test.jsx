import { render, screen } from "@testing-library/react";
import { api } from "@/lib/apiClient";
import TasksPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
  getErrorMessage: (_err, fallback) => fallback,
}));

const TASK = {
  Id: 5, Title: "Visit Dr Shah", Status: "Pending", Priority: "High", DoctorName: "Dr Shah",
};

function ok(data) {
  return Promise.resolve({ data: { success: true, data } });
}

function forbidden() {
  const err = Object.assign(new Error("Request failed with status code 403"), {
    response: { status: 403, data: { errorCode: "FORBIDDEN" } },
  });
  return Promise.reject(err);
}

describe("TasksPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows an EMPLOYEE their tasks although /employees is forbidden for them", async () => {
    // Arrange
    api.get.mockImplementation((url) => {
      if (url === "/tasks") return ok([TASK]);
      if (url === "/doctors") return ok([]);
      return forbidden();
    });

    // Act
    render(<TasksPage />);

    // Assert
    expect((await screen.findAllByText("Visit Dr Shah")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Failed to load data.")).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/employees");
  });

  it("reports a failure when the tasks themselves cannot be loaded", async () => {
    // Arrange
    api.get.mockImplementation((url) => (url === "/tasks" ? forbidden() : ok([])));

    // Act
    render(<TasksPage />);

    // Assert
    expect(await screen.findByText("Failed to load data.")).toBeInTheDocument();
  });
});
