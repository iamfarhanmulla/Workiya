jest.mock("../services/auth.service");

const authService = require("../services/auth.service");
const AppError = require("../utils/AppError");
const { logout, refresh } = require("./auth.controller");
const { mockResponse } = require("../../test/helpers/mockResponse");

function bareRequest() {
  return { ip: "127.0.0.1", get: () => undefined };
}

describe("auth.controller without cookie-parser", () => {
  it("passes an undefined refresh token to logout and still clears cookies", async () => {
    // Arrange
    const res = mockResponse();
    authService.logout.mockResolvedValue(undefined);

    // Act
    await logout(bareRequest(), res);

    // Assert
    expect(authService.logout).toHaveBeenCalledWith({
      refreshToken: undefined, ip: "127.0.0.1", userAgent: "",
    });
    expect(res.clearCookie).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("clears cookies and rethrows when the session is rejected", async () => {
    // Arrange
    const res = mockResponse();
    const error = new AppError(401, "AUTH_REFRESH_INVALID", "Session is no longer valid.");
    authService.refresh.mockRejectedValue(error);

    // Act
    const result = refresh(bareRequest(), res);

    // Assert
    await expect(result).rejects.toBe(error);
    expect(res.clearCookie).toHaveBeenCalledTimes(3);
  });

  it("keeps cookies and rethrows when refresh fails for a transient reason", async () => {
    // Arrange
    const res = mockResponse();
    const error = new Error("db down");
    authService.refresh.mockRejectedValue(error);

    // Act
    const result = refresh(bareRequest(), res);

    // Assert
    await expect(result).rejects.toBe(error);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it("does not set cookies when another tab already rotated the token", async () => {
    // Arrange
    const res = mockResponse();
    authService.refresh.mockResolvedValue({ user: { id: 1 }, rotatedConcurrently: true });

    // Act
    await refresh(bareRequest(), res);

    // Assert
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data).toEqual({ user: { id: 1 } });
  });
});
