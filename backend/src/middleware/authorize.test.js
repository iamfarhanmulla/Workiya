const { authorize } = require("./authorize");
const { ROLES } = require("../constants/roles");
const { mockResponse } = require("../../test/helpers/mockResponse");

describe("authorize middleware", () => {
  it("calls next when the role is allowed", () => {
    // Arrange
    const middleware = authorize(ROLES.SUPER_ADMIN, ROLES.ADMIN);
    const req = { user: { id: 1, roleCode: ROLES.ADMIN } };
    const next = jest.fn();

    // Act
    middleware(req, mockResponse(), next);

    // Assert
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 403 FORBIDDEN when the role is not allowed", () => {
    // Arrange
    const middleware = authorize(ROLES.SUPER_ADMIN);
    const res = mockResponse();
    const next = jest.fn();

    // Act
    middleware({ user: { id: 1, roleCode: ROLES.EMPLOYEE } }, res, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: false, errorCode: "FORBIDDEN" });
  });

  it("returns 403 when there is no authenticated user", () => {
    // Arrange
    const middleware = authorize(ROLES.ADMIN);
    const res = mockResponse();

    // Act
    middleware({}, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
