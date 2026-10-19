import { render, screen } from "@testing-library/react";
import { api } from "@/lib/apiClient";
import DoctorsPage from "./page";

jest.mock("@/lib/apiClient", () => ({
  api: {
    get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn(),
  },
  getErrorMessage: (_err, fallback) => fallback,
}));

const DOCTOR = {
  Id: 1, Name: "Dr Meera Shah", Specialization: "Cardiologist", IsActive: true,
};

function forbidden() {
  const err = Object.assign(new Error("Request failed with status code 403"), {
    response: { status: 403, data: { errorCode: "FORBIDDEN" } },
  });
  return Promise.reject(err);
}

describe("DoctorsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the doctors even when the role may not list companies", async () => {
    // Arrange
    api.get.mockImplementation((url) => (
      url === "/doctors" ? Promise.resolve({
        data: {
          success: true,
          data: [DOCTOR],
        },
      }) : forbidden()
    ));

    // Act
    render(<DoctorsPage />);

    // Assert
    expect((await screen.findAllByText("Dr Meera Shah")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Failed to load data.")).not.toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/companies");
  });

  it("reports a failure when the doctors themselves cannot be loaded", async () => {
    // Arrange
    api.get.mockImplementation(() => forbidden());

    // Act
    render(<DoctorsPage />);

    // Assert
    expect(await screen.findByText("Failed to load data.")).toBeInTheDocument();
  });
});
