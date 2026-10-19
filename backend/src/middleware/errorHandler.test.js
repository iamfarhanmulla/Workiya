jest.mock("../utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const { errorHandler } = require("./errorHandler");
const { mockResponse } = require("../../test/helpers/mockResponse");

const req = { method: "GET", path: "/x" };

describe("errorHandler middleware", () => {
  it("maps an AppError to the wrapper with its status and code", () => {
    // Arrange
    const res = mockResponse();

    // Act
    errorHandler(new AppError(423, "AUTH_ACCOUNT_LOCKED", "Locked."), req, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(423);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: false,
      data: null,
      errorCode: "AUTH_ACCOUNT_LOCKED",
      message: "Locked."
    });
  });

  it("maps a body-parser JSON SyntaxError to 400 INVALID_JSON", () => {
    // Arrange
    const err = new SyntaxError("Unexpected token");
    err.type = "entity.parse.failed";
    const res = mockResponse();

    // Act
    errorHandler(err, req, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errorCode).toBe("INVALID_JSON");
  });

  it("hides unexpected errors behind 500 INTERNAL_ERROR and logs them", () => {
    // Arrange
    const err = new Error("Login failed for user 'sa' on server db01");
    const res = mockResponse();

    // Act
    errorHandler(err, req, res, jest.fn());

    // Assert
    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(body)).not.toMatch(/'sa'|db01|stack/);
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ err }), "Unhandled request error");
  });
});
