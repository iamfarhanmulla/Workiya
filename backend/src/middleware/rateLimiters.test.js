const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const {
  createLoginIpLimiter,
  createLoginLimiter,
  createRefreshIpLimiter,
  createRefreshLimiter,
  loginKey
} = require("./rateLimiters");

function appWith(limiter) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post("/", limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

async function repeat(times, send) {
  for (let i = 0; i < times; i += 1) {
    await send(i);
  }
}

describe("rate limiters", () => {
  it("allows 10 login attempts per IP and email, then returns 429 RATE_LIMITED", async () => {
    // Arrange
    const app = appWith(createLoginLimiter());
    const attempt = (email) => request(app).post("/").send({ email });
    await repeat(10, () => attempt("User@Example.com"));

    // Act
    const blocked = await attempt("user@example.com ");
    const otherEmail = await attempt("someone@example.com");

    // Assert
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ success: false, data: null, errorCode: "RATE_LIMITED" });
    expect(blocked.body.timestamp).toEqual(expect.any(String));
    expect(otherEmail.status).toBe(200);
  });

  it("keys login attempts without an email by IP only", async () => {
    // Arrange
    const app = appWith(createLoginLimiter());

    // Act
    const response = await request(app).post("/").send({});

    // Assert
    expect(response.status).toBe(200);
  });

  it("caps login attempts per IP at 100 across different emails (password spraying)", async () => {
    // Arrange
    const app = appWith(createLoginIpLimiter());
    await repeat(100, (i) => request(app).post("/").send({ email: `user${i}@example.com` }));

    // Act
    const blocked = await request(app).post("/").send({ email: "fresh@example.com" });

    // Assert
    expect(blocked.status).toBe(429);
    expect(blocked.body.errorCode).toBe("RATE_LIMITED");
  });

  it("allows 30 refresh calls per refresh token, separately for each token", async () => {
    // Arrange
    const app = appWith(createRefreshLimiter());
    await repeat(30, () => request(app).post("/").set("Cookie", "wk_rt=token-a"));

    // Act
    const blocked = await request(app).post("/").set("Cookie", "wk_rt=token-a");
    const otherUser = await request(app).post("/").set("Cookie", "wk_rt=token-b");

    // Assert
    expect(blocked.status).toBe(429);
    expect(blocked.body.errorCode).toBe("RATE_LIMITED");
    expect(otherUser.status).toBe(200);
  });

  it("does not count refresh calls that carry no refresh cookie", async () => {
    // Arrange
    const app = appWith(createRefreshLimiter());
    const ipApp = appWith(createRefreshIpLimiter());
    await repeat(31, () => request(app).post("/"));

    // Act
    const tokenLimited = await request(app).post("/");
    const ipLimited = await request(ipApp).post("/");

    // Assert
    expect(tokenLimited.status).toBe(200);
    expect(ipLimited.status).toBe(200);
  });

  it("treats a request without parsed cookies as having no refresh cookie", async () => {
    // Arrange
    const app = express();
    app.post("/", createRefreshLimiter(), (_req, res) => res.json({ ok: true }));
    await repeat(31, () => request(app).post("/").set("Cookie", "wk_rt=raw"));

    // Act
    const response = await request(app).post("/");

    // Assert
    expect(response.status).toBe(200);
  });

  it("caps refresh calls per IP at 600 across tokens", async () => {
    // Arrange
    const app = appWith(createRefreshIpLimiter());
    await repeat(600, (i) => request(app).post("/").set("Cookie", `wk_rt=t${i}`));

    // Act
    const blocked = await request(app).post("/").set("Cookie", "wk_rt=new");

    // Assert
    expect(blocked.status).toBe(429);
  });
});

describe("loginKey", () => {
  it("falls back to an empty IP when the request has none", () => {
    // Arrange
    const req = { body: { email: " A@B.com " } };

    // Act
    const key = loginKey(req);

    // Assert
    expect(key).toMatch(/\|a@b\.com$/);
  });
});
