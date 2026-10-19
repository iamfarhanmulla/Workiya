const { setAuthCookies, clearAuthCookies, REFRESH_PATH } = require("./authCookies");
const { mockResponse } = require("../../test/helpers/mockResponse");

const DAY_MS = 24 * 60 * 60 * 1000;

function cookieCall(res, name) {
  return res.cookie.mock.calls.find(([cookieName]) => cookieName === name);
}

describe("authCookies", () => {
  it("sets three httpOnly SameSite=Strict cookies for a session login", () => {
    // Arrange
    const res = mockResponse();

    // Act
    setAuthCookies(res, { accessToken: "at", refreshToken: "rt", isPersistent: false });

    // Assert
    const [, atValue, atOptions] = cookieCall(res, "wk_at");
    const [, rtValue, rtOptions] = cookieCall(res, "wk_rt");
    const [, sessionValue, sessionOptions] = cookieCall(res, "wk_session");
    expect([atValue, rtValue, sessionValue]).toEqual(["at", "rt", "1"]);
    expect(atOptions).toEqual({
      httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: 900000,
    });
    expect(rtOptions).toEqual({
      httpOnly: true, sameSite: "strict", secure: false, path: REFRESH_PATH,
    });
    expect(sessionOptions).toEqual({
      httpOnly: true, sameSite: "strict", secure: false, path: "/",
    });
  });

  it("gives persistent cookies the remaining server-side lifetime", () => {
    // Arrange
    const res = mockResponse();
    const refreshExpiresAt = new Date(Date.now() + 10 * DAY_MS);

    // Act
    setAuthCookies(res, {
      accessToken: "at", refreshToken: "rt", isPersistent: true, refreshExpiresAt,
    });

    // Assert
    const rtMaxAge = cookieCall(res, "wk_rt")[2].maxAge;
    expect(rtMaxAge).toBeGreaterThan(10 * DAY_MS - 5000);
    expect(rtMaxAge).toBeLessThanOrEqual(10 * DAY_MS);
    expect(cookieCall(res, "wk_session")[2].maxAge).toBe(rtMaxAge);
  });

  it("defaults persistent cookies to 30 days without an explicit expiry", () => {
    // Arrange
    const res = mockResponse();

    // Act
    setAuthCookies(res, { accessToken: "at", refreshToken: "rt", isPersistent: true });

    // Assert
    expect(cookieCall(res, "wk_rt")[2].maxAge).toBe(30 * DAY_MS);
  });

  it("adds Secure and the configured domain to set and cleared cookies", () => {
    // Arrange
    const res = mockResponse();
    let cookies;
    jest.isolateModules(() => {
      jest.doMock("../config/env", () => ({
        ...jest.requireActual("../config/env"),
        secureCookies: true,
        cookieDomain: ".example.com",
      }));
      // eslint-disable-next-line n/global-require -- reload inside isolateModules with new env
      cookies = require("./authCookies");
    });

    // Act
    cookies.setAuthCookies(res, { accessToken: "at", refreshToken: "rt", isPersistent: false });
    cookies.clearAuthCookies(res);

    // Assert
    const options = [...res.cookie.mock.calls, ...res.clearCookie.mock.calls]
      .map((call) => call[call.length - 1]);
    expect(options).toHaveLength(6);
    options.forEach((option) => {
      expect(option).toMatchObject({ secure: true, domain: ".example.com" });
    });
    jest.dontMock("../config/env");
  });

  it("clears all three cookies on their original paths", () => {
    // Arrange
    const res = mockResponse();

    // Act
    clearAuthCookies(res);

    // Assert
    const cleared = res.clearCookie.mock.calls.map(([name, options]) => [name, options.path]);
    expect(cleared).toEqual([
      ["wk_at", "/"],
      ["wk_rt", REFRESH_PATH],
      ["wk_session", "/"],
    ]);
  });
});
