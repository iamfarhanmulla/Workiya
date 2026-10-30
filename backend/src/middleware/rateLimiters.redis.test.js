const express = require("express");
const request = require("supertest");

const mockClient = { eval: jest.fn(), decr: jest.fn(), del: jest.fn() };
jest.mock("./redisRateLimitStore", () => {
  const actual = jest.requireActual("./redisRateLimitStore");
  return {
    ...actual,
    storeFor: (name) => new actual.RedisRateLimitStore({ client: mockClient, prefix: `${name}:` }),
  };
});
jest.mock("../utils/logger", () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const logger = require("../utils/logger");
const { createLoginIpLimiter } = require("./rateLimiters");

function appWith(limiter) {
  const app = express();
  app.post("/", limiter, (_req, res) => res.json({ ok: true }));
  return app;
}

describe("rate limiters with Redis", () => {
  it("uses the shared store and blocks once Redis reports the limit is used up", async () => {
    // Arrange
    mockClient.eval.mockResolvedValue([101, 60000]);

    // Act
    const res = await request(appWith(createLoginIpLimiter())).post("/");

    // Assert
    expect(res.status).toBe(429);
    expect(mockClient.eval.mock.calls[0][1][0]).toMatch(/^login-ip:/);
  });

  it("lets the request through and logs when Redis is unreachable", async () => {
    // Arrange
    mockClient.eval.mockRejectedValue(new Error("fetch failed"));

    // Act
    const res = await request(appWith(createLoginIpLimiter())).post("/");

    // Assert
    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalled();
  });
});
