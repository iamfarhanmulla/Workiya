const request = require("supertest");
const app = require("../src/app");
const handler = require(".");

describe("Vercel entry point", () => {
  it("exports the Express app itself", () => {
    // Assert
    expect(handler).toBe(app);
  });

  it("serves the versioned API through the handler", async () => {
    // Act
    const res = await request(handler).get("/api/v1/health");

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
