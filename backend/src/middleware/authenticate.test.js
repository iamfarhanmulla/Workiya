const jwt = require("jsonwebtoken");
const config = require("../config/env");
const { authenticate } = require("./authenticate");
const { signAccessToken } = require("../services/token.service");
const { mockResponse } = require("../../test/helpers/mockResponse");

function bodyOf(res) {
  return res.json.mock.calls[0][0];
}

describe("authenticate middleware", () => {
  it("sets req.user from a valid wk_at cookie", () => {
    // Arrange
    const token = signAccessToken({
      id: 5, companyId: 2, roleId: 1, roleCode: "SUPER_ADMIN",
    });
    const req = { cookies: { wk_at: token } };
    const res = mockResponse();
    const next = jest.fn();

    // Act
    authenticate(req, res, next);

    // Assert
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual({
      id: 5, companyId: 2, roleId: 1, roleCode: "SUPER_ADMIN",
    });
  });

  it.each([
    ["no cookies object", {}],
    ["no wk_at cookie", { cookies: {} }],
  ])("returns 401 AUTH_REQUIRED with %s", (_label, req) => {
    // Arrange
    const res = mockResponse();
    const next = jest.fn();

    // Act
    authenticate(req, res, next);

    // Assert
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyOf(res)).toMatchObject({ success: false, data: null, errorCode: "AUTH_REQUIRED" });
  });

  it("returns 401 AUTH_TOKEN_EXPIRED for an expired token", () => {
    // Arrange
    const expired = jwt.sign({
      cid: 1, rid: 1, role: "ADMIN", exp: Math.floor(Date.now() / 1000) - 10,
    }, config.jwt.privateKey, {
      algorithm: "RS256",
      subject: "1",
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
    const res = mockResponse();

    // Act
    authenticate({ cookies: { wk_at: expired } }, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyOf(res).errorCode).toBe("AUTH_TOKEN_EXPIRED");
  });

  it("returns 401 AUTH_INVALID_TOKEN for a tampered token", () => {
    // Arrange
    const token = `${signAccessToken({
      id: 1, companyId: 1, roleId: 1, roleCode: "ADMIN",
    })}x`;
    const res = mockResponse();

    // Act
    authenticate({ cookies: { wk_at: token } }, res, jest.fn());

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(bodyOf(res).errorCode).toBe("AUTH_INVALID_TOKEN");
  });
});
