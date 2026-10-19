import { AxiosError } from "axios";
import { api, getErrorMessage, setSessionExpiredHandler } from "./apiClient";

function reply(config, status, data) {
  const response = { data, status, statusText: String(status), headers: {}, config };
  if (status < 400) return Promise.resolve(response);
  return Promise.reject(new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, null, response));
}

function expired(config) {
  return reply(config, 401, { success: false, errorCode: "AUTH_TOKEN_EXPIRED", message: "Expired" });
}

function callsTo(adapter, url) {
  return adapter.mock.calls.filter(([config]) => config.url === url).length;
}

describe("apiClient", () => {
  let adapter;

  beforeEach(() => {
    adapter = jest.fn();
    api.defaults.adapter = adapter;
    setSessionExpiredHandler(null);
  });

  it("is configured for cookie auth with the CSRF header", () => {
    // Arrange
    const { defaults } = api;

    // Act
    const csrfHeader = defaults.headers["X-Requested-With"];

    // Assert
    expect(defaults.baseURL).toMatch(/\/api\/v1$/);
    expect(defaults.withCredentials).toBe(true);
    expect(csrfHeader).toBe("XMLHttpRequest");
  });

  it("refreshes the session and retries the request after AUTH_TOKEN_EXPIRED", async () => {
    // Arrange
    let companyCalls = 0;
    adapter.mockImplementation((config) => {
      if (config.url === "/auth/refresh") return reply(config, 200, { success: true });
      companyCalls += 1;
      return companyCalls === 1 ? expired(config) : reply(config, 200, { success: true, data: [1] });
    });

    // Act
    const res = await api.get("/companies");

    // Assert
    expect(res.data).toEqual({ success: true, data: [1] });
    expect(callsTo(adapter, "/auth/refresh")).toBe(1);
    expect(callsTo(adapter, "/companies")).toBe(2);
  });

  it("shares one refresh call between concurrent 401 responses", async () => {
    // Arrange
    const retried = new Set();
    adapter.mockImplementation((config) => {
      if (config.url === "/auth/refresh") return reply(config, 200, { success: true });
      if (retried.has(config.url)) return reply(config, 200, { success: true, data: config.url });
      retried.add(config.url);
      return reply(config, 401, { success: false, errorCode: "AUTH_REQUIRED" });
    });

    // Act
    const [a, b] = await Promise.all([api.get("/companies"), api.get("/users")]);

    // Assert
    expect(a.data.data).toBe("/companies");
    expect(b.data.data).toBe("/users");
    expect(callsTo(adapter, "/auth/refresh")).toBe(1);
  });

  it("retries a request only once", async () => {
    // Arrange
    adapter.mockImplementation((config) => (
      config.url === "/auth/refresh" ? reply(config, 200, { success: true }) : expired(config)
    ));

    // Act
    const result = api.get("/companies");

    // Assert
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(callsTo(adapter, "/companies")).toBe(2);
    expect(callsTo(adapter, "/auth/refresh")).toBe(1);
  });

  it("calls the session-expired handler when the refresh fails", async () => {
    // Arrange
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    adapter.mockImplementation((config) => (
      config.url === "/auth/refresh"
        ? reply(config, 401, { success: false, errorCode: "AUTH_REFRESH_INVALID" })
        : expired(config)
    ));

    // Act
    const result = api.get("/companies");

    // Assert
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("calls the session-expired handler when the refresh token was reused", async () => {
    // Arrange
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    adapter.mockImplementation((config) => (
      config.url === "/auth/refresh"
        ? reply(config, 401, { success: false, errorCode: "AUTH_REFRESH_REUSED" })
        : expired(config)
    ));

    // Act
    const result = api.get("/companies");

    // Assert
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a 429 rate limit", (config) => reply(config, 429, { success: false, errorCode: "RATE_LIMITED" })],
    ["a 500 server error", (config) => reply(config, 500, { success: false, errorCode: "INTERNAL_ERROR" })],
    ["a network error", (config) => Promise.reject(new AxiosError("Network Error", "ERR_NETWORK", config))],
  ])("keeps the session when the refresh fails with %s", async (_label, refreshReply) => {
    // Arrange
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    adapter.mockImplementation((config) => (
      config.url === "/auth/refresh" ? refreshReply(config) : expired(config)
    ));

    // Act
    const result = api.get("/companies");

    // Assert
    await expect(result).rejects.toMatchObject({ response: { data: { errorCode: "AUTH_TOKEN_EXPIRED" } } });
    expect(callsTo(adapter, "/auth/refresh")).toBe(1);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("does not try to refresh for a failed login", async () => {
    // Arrange
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);
    adapter.mockImplementation((config) => (
      reply(config, 401, { success: false, errorCode: "AUTH_REQUIRED", message: "Nope" })
    ));

    // Act
    const result = api.post("/auth/login", { email: "a@b.c", password: "x" });

    // Assert
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(callsTo(adapter, "/auth/refresh")).toBe(0);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it("does not refresh for 401 responses with other error codes", async () => {
    // Arrange
    adapter.mockImplementation((config) => (
      reply(config, 401, { success: false, errorCode: "AUTH_INVALID_TOKEN" })
    ));

    // Act
    const result = api.get("/companies");

    // Assert
    await expect(result).rejects.toMatchObject({ response: { status: 401 } });
    expect(callsTo(adapter, "/auth/refresh")).toBe(0);
  });

  it("does not refresh for non-401 errors", async () => {
    // Arrange
    adapter.mockImplementation((config) => (
      reply(config, 403, { success: false, errorCode: "AUTH_TOKEN_EXPIRED" })
    ));

    // Act
    const result = api.get("/companies");

    // Assert
    await expect(result).rejects.toMatchObject({ response: { status: 403 } });
    expect(callsTo(adapter, "/auth/refresh")).toBe(0);
  });

  it("rejects with the original error when the refresh fails and no handler is set", async () => {
    // Arrange
    adapter.mockImplementation((config) => (
      config.url === "/auth/refresh"
        ? reply(config, 401, { success: false, errorCode: "AUTH_REFRESH_INVALID" })
        : expired(config)
    ));

    // Act
    const result = api.request({ method: "get" });

    // Assert
    await expect(result).rejects.toMatchObject({ response: { data: { errorCode: "AUTH_TOKEN_EXPIRED" } } });
    expect(callsTo(adapter, "/auth/refresh")).toBe(1);
  });
});

describe("getErrorMessage", () => {
  it("returns the server message when present", () => {
    // Arrange
    const err = { response: { data: { message: "Invalid email or password." } } };

    // Act
    const message = getErrorMessage(err, "Fallback");

    // Assert
    expect(message).toBe("Invalid email or password.");
  });

  it("returns a connection message when there is no response", () => {
    // Arrange
    const err = new AxiosError("Network Error", "ERR_NETWORK");

    // Act
    const message = getErrorMessage(err, "Fallback");

    // Assert
    expect(message).toBe("Cannot connect to server.");
  });

  it("returns the fallback when the response has no message", () => {
    // Arrange
    const err = { response: { status: 500, data: {} } };

    // Act
    const message = getErrorMessage(err, "Fallback");

    // Assert
    expect(message).toBe("Fallback");
  });
});
