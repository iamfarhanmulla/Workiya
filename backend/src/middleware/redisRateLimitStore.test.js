/* eslint-disable @stylistic/max-len -- readable one-line expectations */
const express = require("express");
const request = require("supertest");
const { rateLimit } = require("express-rate-limit");
const { RedisRateLimitStore, storeFor, INCREMENT_SCRIPT } = require("./redisRateLimitStore");

// Behaves like Redis for the commands the store uses; eval runs INCREMENT_SCRIPT's logic.
function fakeRedis() {
  const counts = new Map();
  return {
    counts,
    eval: jest.fn(async (script, [key], [windowMs]) => {
      expect(script).toBe(INCREMENT_SCRIPT);
      counts.set(key, (counts.get(key) || 0) + 1);
      return [counts.get(key), windowMs];
    }),
    decr: jest.fn(async (key) => counts.set(key, counts.get(key) - 1)),
    del: jest.fn(async (key) => counts.delete(key)),
  };
}

describe("RedisRateLimitStore", () => {
  it("counts hits under its own prefix and reports when the window resets", async () => {
    // Arrange
    const client = fakeRedis();
    const store = new RedisRateLimitStore({ client, prefix: "wk:rl:login:" });
    store.init({ windowMs: 60000 });
    const before = Date.now();

    // Act
    await store.increment("1.2.3.4");
    const second = await store.increment("1.2.3.4");

    // Assert
    expect(second.totalHits).toBe(2);
    expect(second.resetTime.getTime()).toBeGreaterThanOrEqual(before + 60000);
    expect(client.eval).toHaveBeenLastCalledWith(INCREMENT_SCRIPT, ["wk:rl:login:1.2.3.4"], [60000]);
    expect(store.localKeys).toBe(false);
  });

  it("decrements and resets a key", async () => {
    // Arrange
    const client = fakeRedis();
    const store = new RedisRateLimitStore({ client, prefix: "p:" });
    await store.increment("k");
    await store.increment("k");

    // Act
    await store.decrement("k");
    const afterDecrement = client.counts.get("p:k");
    await store.resetKey("k");

    // Assert
    expect(afterDecrement).toBe(1);
    expect(client.counts.has("p:k")).toBe(false);
  });

  it("blocks over the limit when used by express-rate-limit, shared across app instances", async () => {
    // Arrange: two separate apps (like two Vercel instances) on one Redis.
    const client = fakeRedis();
    const appWith = () => {
      const app = express();
      app.get("/", rateLimit({
        windowMs: 60000,
        limit: 2,
        store: new RedisRateLimitStore({ client, prefix: "t:" }),
      }), (_req, res) => res.send("ok"));
      return app;
    };
    const first = appWith();
    const second = appWith();

    // Act
    await request(first).get("/");
    await request(second).get("/");
    const blocked = await request(first).get("/");

    // Assert
    expect(blocked.status).toBe(429);
  });
});

describe("storeFor", () => {
  it("returns no store when Upstash is not configured", () => {
    // Assert
    expect(storeFor("login", { redisUrl: "", redisToken: "" })).toBeUndefined();
    expect(storeFor("login", { redisUrl: "https://x.upstash.io", redisToken: "" })).toBeUndefined();
  });

  it("returns a prefixed Redis store when it is configured", () => {
    // Arrange
    const client = fakeRedis();

    // Act
    const store = storeFor("refresh-ip", { redisUrl: "https://x.upstash.io", redisToken: "t" }, client);

    // Assert
    expect(store).toBeInstanceOf(RedisRateLimitStore);
    expect(store.prefix).toBe("wk:rl:refresh-ip:");
  });

  it("creates the Upstash REST client itself when none is given", () => {
    // Act
    const store = storeFor("login", { redisUrl: "https://x.upstash.io", redisToken: "t" });

    // Assert
    expect(typeof store.client.eval).toBe("function");
  });
});
