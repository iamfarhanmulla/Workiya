const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const { createDocsRouter } = require("./docs.routes");
const { USERS, authCookie } = require("../../test/helpers/apiHarness");

function appWith(options) {
  const app = express();
  app.use(cookieParser());
  app.use("/api/v1/docs", createDocsRouter(options));
  return app;
}

describe("API docs routes", () => {
  it("serves the Swagger page with pinned, integrity-checked files and a strict CSP", async () => {
    // Act
    const res = await request(appWith({ open: true })).get("/api/v1/docs");

    // Assert
    expect(res.status).toBe(200);
    expect(res.text).toContain("swagger-ui-dist@5.17.14/swagger-ui-bundle.js");
    expect(res.text).toMatch(/integrity="sha384-[A-Za-z0-9+/=]+"/);
    expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(res.headers["content-security-policy"]).toContain("connect-src 'self'");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("serves the init script that adds the CSRF header and the OpenAPI document", async () => {
    // Arrange
    const app = appWith({ open: true });

    // Act
    const init = await request(app).get("/api/v1/docs/init.js");
    const spec = await request(app).get("/api/v1/docs/openapi.json");

    // Assert
    expect(init.headers["content-type"]).toMatch(/javascript/);
    expect(init.text).toContain("X-Requested-With");
    expect(spec.body.openapi).toBe("3.0.3");
    expect(spec.body.paths["/visit-plans/preview"].post).toBeDefined();
  });

  it("needs a login when closed (production)", async () => {
    // Act
    const res = await request(appWith({ open: false })).get("/api/v1/docs/openapi.json");

    // Assert
    expect(res.status).toBe(401);
  });

  it("refuses any role other than SUPER_ADMIN when closed", async () => {
    // Act
    const res = await request(appWith({ open: false }))
      .get("/api/v1/docs")
      .set("Cookie", authCookie(USERS.admin));

    // Assert
    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe("FORBIDDEN");
  });

  it("lets a SUPER_ADMIN read the docs when closed", async () => {
    // Act
    const res = await request(appWith({ open: false }))
      .get("/api/v1/docs/openapi.json")
      .set("Cookie", authCookie(USERS.superAdmin));

    // Assert
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe("Workiya API");
  });
});
