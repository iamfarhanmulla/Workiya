jest.mock("../repositories/user.repository");
jest.mock("../repositories/refreshToken.repository");
jest.mock("../repositories/auditLog.repository");

const request = require("supertest");
const app = require("../app");
const userRepository = require("../repositories/user.repository");
const refreshTokenRepository = require("../repositories/refreshToken.repository");
const auditLogRepository = require("../repositories/auditLog.repository");
const {
  TEST_PASSWORD: PASSWORD,
  userRow: fixtureUserRow,
  installFakeTokenStore,
} = require("../../test/helpers/authFixtures");

const XHR = { "X-Requested-With": "XMLHttpRequest" };
const ADMIN = {
  Id: 21, CompanyId: 4, RoleId: 2, RoleCode: "ADMIN", RoleName: "Admin", Email: "admin@example.com",
};

let tokenStore;

function userRow(overrides = {}) {
  return fixtureUserRow({ ...ADMIN, ...overrides });
}

function cookieHeader(response, name) {
  return (response.headers["set-cookie"] || []).find((cookie) => cookie.startsWith(`${name}=`));
}

function cookieValue(response, name) {
  return cookieHeader(response, name).split(";")[0];
}

function login(body = {}) {
  return request(app)
    .post("/api/v1/auth/login")
    .set(XHR)
    .send({ email: "admin@example.com", password: PASSWORD, ...body });
}

beforeEach(() => {
  tokenStore = installFakeTokenStore(refreshTokenRepository);
  auditLogRepository.insert.mockResolvedValue(undefined);
  userRepository.findActiveByEmail.mockResolvedValue(userRow());
  userRepository.findActiveById.mockResolvedValue(userRow());
  userRepository.recordFailedLogin.mockResolvedValue({ failedLoginCount: 1, lockoutEndUtc: null });
});

function ageRotation(seconds) {
  tokenStore
    .filter((t) => t.RevokedReason === "ROTATED")
    .forEach((t) => Object.assign(t, { RevokedAtUtc: new Date(Date.now() - seconds * 1000) }));
}

describe("POST /api/v1/auth/login", () => {
  it("sets three HttpOnly SameSite=Strict cookies and returns the user "
    + "in the wrapper", async () => {
    // Arrange / Act
    const response = await login({ rememberMe: true });

    // Assert
    expect(response.status).toBe(200);
    expect(response.body)
      .toMatchObject({ success: true, errorCode: null, message: "Login successful." });
    expect(response.body.data.user)
      .toMatchObject({ id: 21, roleCode: "ADMIN", email: "admin@example.com" });
    expect(JSON.stringify(response.body)).not.toMatch(/Password/i);
    ["wk_at", "wk_rt", "wk_session"].forEach((name) => {
      const cookie = cookieHeader(response, name);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
    });
    expect(cookieHeader(response, "wk_rt")).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookieHeader(response, "wk_rt")).toMatch(/Max-Age=/);
  });

  it("returns 401 for a wrong password", async () => {
    // Arrange / Act
    const response = await login({ password: "wrong-password" });

    // Assert
    expect(response.status).toBe(401);
    expect(response.body)
      .toMatchObject({ success: false, data: null, errorCode: "AUTH_INVALID_CREDENTIALS" });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("answers a locked account with the same 401 body as a wrong password", async () => {
    // Arrange
    userRepository.findActiveByEmail
      .mockResolvedValue(userRow({ LockoutEndUtc: new Date(Date.now() + 60000) }));
    const wrong = await login({ password: "wrong-password" });

    // Act
    const locked = await login();

    // Assert
    expect(locked.status).toBe(401);
    expect(locked.body.errorCode).toBe("AUTH_INVALID_CREDENTIALS");
    expect(locked.body.message).toBe(wrong.body.message);
    expect(locked.headers["set-cookie"]).toBeUndefined();
  });

  it("signs in and refreshes a SUPER_ADMIN who has no company", async () => {
    // Arrange
    const superAdmin = userRow({
      Id: 1, CompanyId: null, RoleId: 1, RoleCode: "SUPER_ADMIN",
    });
    userRepository.findActiveByEmail.mockResolvedValue(superAdmin);
    userRepository.findActiveById.mockResolvedValue(superAdmin);

    // Act
    const loginResponse = await login();
    const refreshed = await request(app)
      .post("/api/v1/auth/refresh")
      .set(XHR)
      .set("Cookie", cookieValue(loginResponse, "wk_rt"));

    // Assert
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.data.user)
      .toMatchObject({ companyId: null, roleCode: "SUPER_ADMIN" });
    expect(refreshed.status).toBe(200);
    expect(tokenStore.map((t) => t.CompanyId)).toEqual([null, null]);
  });

  it("returns 403 CSRF_HEADER_MISSING without X-Requested-With", async () => {
    // Arrange / Act
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: PASSWORD });

    // Assert
    expect(response.status).toBe(403);
    expect(response.body.errorCode).toBe("CSRF_HEADER_MISSING");
  });

  it("returns 400 VALIDATION_FAILED for a malformed body", async () => {
    // Arrange / Act
    const response = await login({ email: "nope", rememberMe: "yes" });

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe("VALIDATION_FAILED");
  });

  it("returns 400 INVALID_JSON for unparsable JSON", async () => {
    // Arrange / Act
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set(XHR)
      .set("Content-Type", "application/json")
      .send("{bad json");

    // Assert
    expect(response.status).toBe(400);
    expect(response.body.errorCode).toBe("INVALID_JSON");
  });

  it("returns 500 INTERNAL_ERROR without leaking details when the DB fails", async () => {
    // Arrange
    userRepository.findActiveByEmail.mockRejectedValue(new Error("Connection to db-host failed"));

    // Act
    const response = await login();

    // Assert
    expect(response.status).toBe(500);
    expect(response.body.errorCode).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toMatch(/db-host/);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns 401 AUTH_REQUIRED without a cookie", async () => {
    // Arrange / Act
    const response = await request(app).get("/api/v1/auth/me");

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe("AUTH_REQUIRED");
  });

  it("returns the current user with a valid access cookie", async () => {
    // Arrange
    const loginResponse = await login();

    // Act
    const response = await request(app).get("/api/v1/auth/me")
      .set("Cookie", cookieValue(loginResponse, "wk_at"));

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.data.user.id).toBe(21);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the refresh token and detects reuse of the old one", async () => {
    // Arrange
    const loginResponse = await login();
    const firstRefresh = cookieValue(loginResponse, "wk_rt");

    // Act
    const rotated = await request(app).post("/api/v1/auth/refresh").set(XHR)
      .set("Cookie", firstRefresh);
    ageRotation(31);
    const reused = await request(app).post("/api/v1/auth/refresh").set(XHR)
      .set("Cookie", firstRefresh);
    const secondRefresh = cookieValue(rotated, "wk_rt");
    const afterReuse = await request(app).post("/api/v1/auth/refresh").set(XHR)
      .set("Cookie", secondRefresh);

    // Assert
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.user.id).toBe(21);
    expect(secondRefresh).not.toBe(firstRefresh);
    expect(cookieHeader(rotated, "wk_rt")).not.toMatch(/Max-Age/);
    expect(reused.status).toBe(401);
    expect(reused.body.errorCode).toBe("AUTH_REFRESH_REUSED");
    expect(cookieHeader(reused, "wk_rt")).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(afterReuse.status).toBe(401);
    expect(tokenStore.every((t) => t.RevokedAtUtc)).toBe(true);
  });

  it("answers a second tab that sends the just-rotated token "
    + "without touching its cookies", async () => {
    // Arrange
    const loginResponse = await login();
    const original = cookieValue(loginResponse, "wk_rt");
    const firstTab = await request(app).post("/api/v1/auth/refresh").set(XHR)
      .set("Cookie", original);

    // Act
    const secondTab = await request(app).post("/api/v1/auth/refresh").set(XHR)
      .set("Cookie", original);

    // Assert
    expect(firstTab.status).toBe(200);
    expect(secondTab.status).toBe(200);
    expect(secondTab.body.data.user.id).toBe(21);
    expect(secondTab.headers["set-cookie"]).toBeUndefined();
    expect(tokenStore.filter((t) => !t.RevokedAtUtc)).toHaveLength(1);
  });

  it("keeps the cookies when the refresh fails for a server reason", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockRejectedValue(new Error("db down"));

    // Act
    const response = await request(app).post("/api/v1/auth/refresh").set(XHR)
      .set("Cookie", "wk_rt=abc");

    // Assert
    expect(response.status).toBe(500);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("returns 401 AUTH_REFRESH_INVALID without a refresh cookie", async () => {
    // Arrange / Act
    const response = await request(app).post("/api/v1/auth/refresh").set(XHR);

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe("AUTH_REFRESH_INVALID");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("clears all cookies and revokes the token family, even without an access token", async () => {
    // Arrange
    const loginResponse = await login();

    // Act
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set(XHR)
      .set("Cookie", cookieValue(loginResponse, "wk_rt"));

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: null, message: "Logged out." });
    ["wk_at", "wk_rt", "wk_session"].forEach((name) => {
      expect(cookieHeader(response, name)).toMatch(/Expires=Thu, 01 Jan 1970/);
    });
    expect(tokenStore[0].RevokedReason).toBe("LOGOUT");
  });

  it("still clears cookies and returns the error when revocation fails", async () => {
    // Arrange
    refreshTokenRepository.findByHash.mockRejectedValue(new Error("db down"));

    // Act
    const response = await request(app).post("/api/v1/auth/logout").set(XHR)
      .set("Cookie", "wk_rt=abc");

    // Assert
    expect(response.status).toBe(500);
    expect(cookieHeader(response, "wk_at")).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});

describe("protected and unknown routes", () => {
  it("returns 401 for GET /api/v1/companies without a cookie", async () => {
    // Arrange / Act
    const response = await request(app).get("/api/v1/companies");

    // Assert
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe("AUTH_REQUIRED");
  });

  it("serves /api/v1/health without authentication", async () => {
    // Arrange / Act
    const response = await request(app).get("/api/v1/health");

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns 404 NOT_FOUND outside /api/v1", async () => {
    // Arrange / Act
    const response = await request(app).get("/api/companies");

    // Assert
    expect(response.status).toBe(404);
    expect(response.body.errorCode).toBe("NOT_FOUND");
  });
});
