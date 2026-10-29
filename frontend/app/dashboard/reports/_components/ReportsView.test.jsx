/* eslint-disable @stylistic/max-len -- readable one-line fixture rows */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "@/lib/apiClient";
import ReportsView from "./ReportsView";

jest.mock("@/lib/apiClient", () => ({
  api: { get: jest.fn(), post: jest.fn() },
  getErrorMessage: (err, fallback) => err?.response?.data?.message || fallback,
}));
const mockUser = jest.fn();
jest.mock("@/hooks/useCurrentUser", () => ({ useCurrentUser: () => mockUser() }));
jest.mock("@/hooks/useTerminology", () => ({
  useTerminology: () => ({
    t: (key) => ({
      "account.singular": "Doctor", "account.plural": "Doctors", "rep.singular": "MR", "rep.plural": "MRs",
    }[key]),
  }),
}));

const COVERAGE = {
  month: "2026-10",
  totals: {
    target: 4, scheduled: 4, completed: 3, missed: 1, open: 0, coveragePercent: 75, approvalPercent: 67,
  },
  byRep: [{
    userId: 30, userName: "Eve", accounts: 2, target: 4, scheduled: 4, completed: 3, missed: 1, open: 0, coveragePercent: 75, approvalPercent: 67,
  }],
  notVisited: [{
    accountId: 8, accountName: "Dr. Beta", userId: 30, userName: "Eve", visitsPerMonth: 1, lastVisitAt: null,
  }],
};
const TREND = [{ weekStart: "2026-10-19", completed: 2, missed: 1 }];

function mockReports() {
  api.get.mockImplementation((url) => Promise.resolve({
    data: { data: url === "/reports/coverage" ? COVERAGE : TREND },
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReports();
});

describe("ReportsView", () => {
  it("shows KPIs, rep coverage, not-visited doctors and the trend", async () => {
    // Arrange
    mockUser.mockReturnValue({ id: 10, companyId: 2, roleCode: "ADMIN" });

    // Act
    render(<ReportsView />);

    // Assert
    expect(await screen.findByText("Coverage by MR")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "MR" })).toHaveLength(2);
    expect(screen.getAllByText("75%").length).toBeGreaterThan(0);
    expect(screen.getByText("Doctors not visited")).toBeInTheDocument();
    expect(screen.getByText("Dr. Beta")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /per week/i })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/reports/coverage", { params: { month: expect.any(String) } });
  });

  it("lets an admin run the missed check and reloads the report", async () => {
    // Arrange
    mockUser.mockReturnValue({ id: 10, companyId: 2, roleCode: "ADMIN" });
    api.post.mockResolvedValue({ data: { message: "2 visit(s) marked as missed." } });
    render(<ReportsView />);
    await screen.findByText("Coverage by MR");

    // Act
    await userEvent.click(screen.getByRole("button", { name: /run missed check now/i }));

    // Assert
    expect(api.post).toHaveBeenCalledWith("/visit-plans/mark-missed", {});
    expect(await screen.findByText("2 visit(s) marked as missed.")).toBeInTheDocument();
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThanOrEqual(4));
  });

  it("shows an employee 'My coverage' without the admin button", async () => {
    // Arrange
    mockUser.mockReturnValue({ id: 30, companyId: 2, roleCode: "EMPLOYEE" });

    // Act
    render(<ReportsView />);

    // Assert
    expect(await screen.findByRole("heading", { name: "My coverage" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run missed check/i })).not.toBeInTheDocument();
  });

  it("shows a retry banner when the report cannot load", async () => {
    // Arrange
    mockUser.mockReturnValue({ id: 10, companyId: 2, roleCode: "ADMIN" });
    api.get.mockRejectedValue({ response: { data: { message: "Server down" } } });

    // Act
    render(<ReportsView />);

    // Assert
    expect(await screen.findByText(/couldn't load reports/i)).toBeInTheDocument();
  });

  it("asks a super admin to choose a company before loading", async () => {
    // Arrange
    mockUser.mockReturnValue({ id: 1, roleCode: "SUPER_ADMIN" });
    api.get.mockResolvedValue({ data: { data: [] } });

    // Act
    render(<ReportsView />);

    // Assert
    expect(await screen.findByText("Choose a company to see its reports.")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/reports/coverage", expect.anything());
  });
});
