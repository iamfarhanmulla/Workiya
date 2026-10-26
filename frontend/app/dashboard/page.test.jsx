import { configureStore } from "@reduxjs/toolkit";
import {
  render, screen, waitFor, within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { api } from "@/lib/apiClient";
import authReducer, { setUser } from "@/store/authSlice";
import settingsReducer from "@/store/settingsSlice";
import DashboardPage from "./page";

jest.mock("@/lib/apiClient", () => ({ api: { get: jest.fn() } }));

const page = (items, total = items.length) => ({ data: { success: true, data: { items, total } } });

function activity(id, status, [assignedTo, assignedToName], accountName, dueAtUtc) {
  return {
    id, status, assignedTo, assignedToName, accountName, dueAtUtc,
  };
}

const PRIYA = [7, "Priya Deshmukh"];
const IMRAN = [8, "Imran Qureshi"];
const ACTIVITIES = [
  activity(1, "Completed", PRIYA, "Dr. Meera Iyer", "2026-10-22T05:00:00Z"),
  activity(2, "Pending", PRIYA, "Dr. Ananya K", "2026-10-22T09:30:00Z"),
  activity(3, "Missed", IMRAN, "Dr. Farida Shaikh", "2026-10-22T04:00:00Z"),
];

const REVIEW = {
  id: 50,
  submittedByName: "Neha Gupta",
  accountName: "Dr. Lakshmi Narayanan",
  submittedAtUtc: "2026-10-22T06:00:00Z",
};

const NO_LABELS = { data: { success: true, data: {} } };

function mockApi({ activities = ACTIVITIES, reviews = [REVIEW], fail = false } = {}) {
  api.get.mockImplementation((path) => {
    if (path === "/settings/terminology") return Promise.resolve(NO_LABELS);
    if (fail) return Promise.reject(new Error("500"));
    if (path === "/activities") return Promise.resolve(page(activities));
    if (path === "/submissions") return Promise.resolve(page(reviews, 12));
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function renderPage(roleCode) {
  const store = configureStore({
    reducer: { auth: authReducer, settings: settingsReducer },
  });
  store.dispatch(setUser({ id: 7, firstName: "Asha", roleCode }));
  render(<Provider store={store}><DashboardPage /></Provider>);
}

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows managers today's totals, reps and the review queue", async () => {
    // Arrange
    mockApi();

    // Act
    renderPage("MANAGER");

    // Assert
    const reps = await screen.findByRole("region", { name: "Reps today" });
    const priyaRow = within(reps).getByText("Priya Deshmukh").closest("tr");
    expect(priyaRow).toHaveTextContent("Priya Deshmukh2150%0");
    expect(within(reps).getByText("Imran Qureshi")).toBeInTheDocument();
    const reviewTile = screen.getByText("Waiting for review", { selector: "span" }).parentElement;
    expect(reviewTile).toHaveTextContent("12");
    expect(screen.getByText("Dr. Lakshmi Narayanan")).toBeInTheDocument();
    expect(screen.getByText("Newest first (showing newest 5)")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/activities", {
      params: expect.objectContaining({ page: 1, pageSize: 200, dateFrom: expect.any(String) }),
    });
  });

  it("shows a rep their own day in time order and never asks for reviews", async () => {
    // Arrange
    mockApi();

    // Act
    renderPage("EMPLOYEE");

    // Assert
    const list = await screen.findByRole("list");
    const names = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(names[0]).toContain("Dr. Farida Shaikh");
    expect(names[2]).toContain("Dr. Ananya K");
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith("/submissions", expect.anything());
  });

  it("offers a retry when today's activities fail to load", async () => {
    // Arrange
    mockApi({ fail: true });
    const user = userEvent.setup();
    renderPage("ADMIN");
    await screen.findByText(/Couldn't load today's/);
    mockApi();

    // Act
    await user.click(screen.getByRole("button", { name: "Try again" }));

    // Assert
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Reps today" })).toBeInTheDocument();
    });
  });

  it("shows empty states when nothing is due or waiting", async () => {
    // Arrange
    mockApi({ activities: [], reviews: [] });

    // Act
    renderPage("ADMIN");

    // Assert
    expect(await screen.findByText("No activities due today")).toBeInTheDocument();
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
  });
});
