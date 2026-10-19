const { csrfProtection } = require("./csrf");
const { mockResponse } = require("../../test/helpers/mockResponse");

function request(method, header) {
  return { method, get: (name) => (name === "X-Requested-With" ? header : undefined) };
}

describe("csrfProtection middleware", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("lets safe method %s through "
    + "without the header", (method) => {
    // Arrange
    const next = jest.fn();

    // Act
    csrfProtection(request(method, undefined), mockResponse(), next);

    // Assert
    expect(next).toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("rejects %s without X-Requested-With", (method) => {
    // Arrange
    const res = mockResponse();
    const next = jest.fn();

    // Act
    csrfProtection(request(method, undefined), res, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].errorCode).toBe("CSRF_HEADER_MISSING");
  });

  it("rejects an unexpected header value", () => {
    // Arrange
    const res = mockResponse();

    // Act
    csrfProtection(request("POST", "fetch"), res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows unsafe methods with X-Requested-With: XMLHttpRequest", () => {
    // Arrange
    const next = jest.fn();

    // Act
    csrfProtection(request("POST", "XMLHttpRequest"), mockResponse(), next);

    // Assert
    expect(next).toHaveBeenCalled();
  });
});
