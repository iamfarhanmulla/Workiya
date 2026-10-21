const { ok, fail } = require("./apiResponse");
const { mockResponse } = require("../../test/helpers/mockResponse");

describe("apiResponse", () => {
  it("ok() writes the success wrapper with defaults", () => {
    // Arrange
    const res = mockResponse();

    // Act
    ok(res, { id: 1 });

    // Assert
    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body).toEqual({
      success: true, data: { id: 1 }, message: "", errorCode: null, timestamp: expect.any(String),
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });

  it("ok() accepts a message and status and normalises undefined data to null", () => {
    // Arrange
    const res = mockResponse();

    // Act
    ok(res, undefined, "Created.", 201);

    // Assert
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toMatchObject({ data: null, message: "Created." });
  });

  it("fail() writes the error wrapper", () => {
    // Arrange
    const res = mockResponse();

    // Act
    fail(res, 404, "NOT_FOUND", "Missing.");

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      data: null,
      message: "Missing.",
      errorCode: "NOT_FOUND",
      timestamp: expect.any(String),
    });
  });
});
